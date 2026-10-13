import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";
import { type ProductItem, MasterStore } from "./store";

export const GOOGLE_SHEETS_SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
];

const provider = new GoogleAuthProvider();
GOOGLE_SHEETS_SCOPES.forEach((scope) => provider.addScope(scope));

// In-memory access token cache (NEVER persisted to localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export interface DriveSpreadsheetFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface SheetTabInfo {
  sheetId: number;
  title: string;
  rowCount?: number;
  columnCount?: number;
}

export interface GoogleSheetsServiceState {
  user: User | null;
  isAuthenticated: boolean;
  accessToken: string | null;
}

/**
 * Initialize auth state listener.
 * Memory token is cleared immediately on sign out.
 */
export function initGoogleAuth(
  onSuccess?: (user: User, token: string) => void,
  onFailure?: () => void,
): () => void {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (cachedAccessToken) {
        if (onSuccess) onSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        if (onFailure) onFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onFailure) onFailure();
    }
  });
}

/**
 * Trigger Google Sign In with popup and request required Workspace scopes
 */
export async function signInWithGoogle(): Promise<{ user: User; accessToken: string }> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("ไม่สามารถรับ OAuth Access Token จาก Google ได้");
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

/**
 * Sign out and clear in-memory credentials
 */
export async function signOutFromGoogle(): Promise<void> {
  await signOut(auth);
  cachedAccessToken = null;
}

/**
 * Retrieve active in-memory access token
 */
export function getGoogleAccessToken(): string | null {
  return cachedAccessToken;
}

/**
 * List Google Spreadsheets accessible by the user in Google Drive
 */
export async function listUserSpreadsheets(token?: string): Promise<DriveSpreadsheetFile[]> {
  const activeToken = token || cachedAccessToken;
  if (!activeToken) {
    throw new Error("ต้องเข้าสู่ระบบ Google ก่อนดำเนินการ");
  }

  const query = encodeURIComponent(
    "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
  );
  const fields = encodeURIComponent("files(id, name, modifiedTime, webViewLink)");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&pageSize=30&orderBy=modifiedTime%20desc`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${activeToken}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Google Drive API error: ${res.statusText}`);
  }

  const data = await res.json();
  return (data.files || []) as DriveSpreadsheetFile[];
}

/**
 * Get spreadsheet details and tab list (Never hardcode Sheet1)
 */
export async function getSpreadsheetMetadata(
  spreadsheetId: string,
  token?: string,
): Promise<{ title: string; sheets: SheetTabInfo[]; spreadsheetUrl: string }> {
  const activeToken = token || cachedAccessToken;
  if (!activeToken) {
    throw new Error("ต้องเข้าสู่ระบบ Google ก่อนดำเนินการ");
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,spreadsheetUrl,sheets.properties`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${activeToken}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Google Sheets API error: ${res.statusText}`);
  }

  const data = (await res.json()) as {
    properties?: { title?: string };
    spreadsheetUrl?: string;
    sheets?: Array<{
      properties?: {
        sheetId?: number;
        title?: string;
        gridProperties?: { rowCount?: number; columnCount?: number };
      };
    }>;
  };
  const sheets: SheetTabInfo[] = (data.sheets || []).map((s) => ({
    sheetId: s.properties?.sheetId ?? 0,
    title: s.properties?.title || "Sheet1",
    rowCount: s.properties?.gridProperties?.rowCount,
    columnCount: s.properties?.gridProperties?.columnCount,
  }));

  return {
    title: data.properties?.title || "Untitled Spreadsheet",
    sheets,
    spreadsheetUrl:
      data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
  };
}

/**
 * Read cell values from a specific spreadsheet and range
 */
export async function readSpreadsheetValues(
  spreadsheetId: string,
  range: string,
  token?: string,
): Promise<string[][]> {
  const activeToken = token || cachedAccessToken;
  if (!activeToken) {
    throw new Error("ต้องเข้าสู่ระบบ Google ก่อนดำเนินการ");
  }

  const encodedRange = encodeURIComponent(range);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${activeToken}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Google Sheets read error: ${res.statusText}`);
  }

  const data = await res.json();
  return (data.values || []) as string[][];
}

/**
 * Create a new Google Spreadsheet with structured headers and initial rows
 */
export async function createNewSpreadsheet(
  title: string,
  initialSheetTitle: string,
  rows: (string | number)[][],
  token?: string,
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const activeToken = token || cachedAccessToken;
  if (!activeToken) {
    throw new Error("ต้องเข้าสู่ระบบ Google ก่อนดำเนินการ");
  }

  const body = {
    properties: {
      title,
    },
    sheets: [
      {
        properties: {
          title: initialSheetTitle,
        },
        data: [
          {
            startRow: 0,
            startColumn: 0,
            rowData: rows.map((row) => ({
              values: row.map((val) => ({
                userEnteredValue:
                  typeof val === "number"
                    ? { numberValue: val }
                    : { stringValue: String(val ?? "") },
              })),
            })),
          },
        ],
      },
    ],
  };

  const res = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${activeToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Create spreadsheet error: ${res.statusText}`);
  }

  const data = await res.json();
  return {
    spreadsheetId: data.spreadsheetId,
    spreadsheetUrl:
      data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}`,
  };
}

/**
 * Update/Overwrite range in an existing spreadsheet (Destructive - requires prior user confirmation)
 */
export async function updateSpreadsheetRange(
  spreadsheetId: string,
  range: string,
  values: (string | number)[][],
  token?: string,
): Promise<{ updatedRows: number; updatedColumns: number }> {
  const activeToken = token || cachedAccessToken;
  if (!activeToken) {
    throw new Error("ต้องเข้าสู่ระบบ Google ก่อนดำเนินการ");
  }

  const encodedRange = encodeURIComponent(range);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}?valueInputOption=USER_ENTERED`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${activeToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      range,
      values,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Update spreadsheet error: ${res.statusText}`);
  }

  const data = await res.json();
  return {
    updatedRows: data.updatedRows || values.length,
    updatedColumns: data.updatedColumns || (values[0]?.length ?? 0),
  };
}

/**
 * Append rows to an existing spreadsheet
 */
export async function appendSpreadsheetRows(
  spreadsheetId: string,
  range: string,
  values: (string | number)[][],
  token?: string,
): Promise<{ updatedRows: number }> {
  const activeToken = token || cachedAccessToken;
  if (!activeToken) {
    throw new Error("ต้องเข้าสู่ระบบ Google ก่อนดำเนินการ");
  }

  const encodedRange = encodeURIComponent(range);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${activeToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      values,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Append spreadsheet error: ${res.statusText}`);
  }

  const data = await res.json();
  return {
    updatedRows: data.updates?.updatedRows || values.length,
  };
}

/**
 * Helper to generate spreadsheet rows for Product Inventory
 */
export function buildProductExportRows(products: ProductItem[]): (string | number)[][] {
  const categories = MasterStore.getCategories();
  const subCategories = MasterStore.getSubCategories();
  const zones = MasterStore.getZones();
  const units = MasterStore.getUnits();

  const getCatName = (id: string) => categories.find((c) => c.id === id)?.name || "-";
  const getSubCatName = (id?: string) => subCategories.find((sc) => sc.id === id)?.name || "-";
  const getZoneName = (id?: string) => zones.find((z) => z.id === id)?.name || "-";
  const getUnitName = (id: string) => units.find((u) => u.id === id)?.name || "ชิ้น";

  const headers = [
    "บาร์โค้ด (Barcode)",
    "รหัสสินค้า (SKU)",
    "ชื่อสินค้า (Product Name)",
    "หมวดหมู่หลัก (Category)",
    "หมวดหมู่ย่อย (Subcategory)",
    "โซนจัดเก็บ (Zone)",
    "หน่วยนับ (Unit)",
    "ราคาต้นทุน (Cost)",
    "ราคาขาย (Sell Price)",
    "สต็อกปัจจุบัน (Current Stock)",
    "จุดสั่งซื้อขั้นต่ำ (Min Stock)",
    "สต็อกเป้าหมาย (Target Stock)",
    "ปริมาณสั่งซื้อแนะนำ (Reorder Qty)",
    "สถานะ (Status)",
    "อัปเดตล่าสุด (Updated At)",
  ];

  const dataRows = products.map((p) => [
    p.barcode,
    p.sku,
    p.name,
    getCatName(p.categoryId),
    getSubCatName(p.subCategoryId),
    getZoneName(p.zoneId),
    getUnitName(p.unitId),
    p.costPrice,
    p.sellPrice,
    p.stock,
    p.minStock,
    p.targetStock,
    p.reorderQuantity,
    p.isActive ? "เปิดขายปกติ" : "ระงับชั่วคราว",
    p.updatedAt || new Date().toISOString(),
  ]);

  return [headers, ...dataRows];
}
