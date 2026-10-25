import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";
import {
  type ProductItem,
  type StockMovementLog,
  type PurchaseOrderRecord,
  MasterStore,
} from "./store";
import { BackupService, type BackupPackage } from "./backup-restore";
import { PrinterService } from "./printer-service";
import { fetchCloudSqlSnapshotFn } from "./line-server-fn";
import {
  getGoogleSheetsAccessTokenFn,
  getGoogleSheetsConfigFn,
  saveGoogleSheetsConfigFn,
  disconnectGoogleSheetsConfigFn,
  testGoogleSheetsConnectionFn,
  extractSpreadsheetId,
  triggerServerBackupToGoogleSheetsFn,
  type GoogleSheetsConfigStatus,
  type ServerBackupResult,
} from "./google-sheets-server-fn";

export {
  getGoogleSheetsAccessTokenFn,
  getGoogleSheetsConfigFn,
  saveGoogleSheetsConfigFn,
  disconnectGoogleSheetsConfigFn,
  testGoogleSheetsConnectionFn,
  extractSpreadsheetId,
  triggerServerBackupToGoogleSheetsFn,
  type GoogleSheetsConfigStatus,
  type ServerBackupResult,
};

/**
 * Scopes configured and authorized via set_up_oauth
 */
export const GOOGLE_SHEETS_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
];

const provider = new GoogleAuthProvider();
GOOGLE_SHEETS_SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({
  prompt: "select_account",
});

// In-memory access token cache with expiration (NEVER persisted to localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let cachedAccessTokenExpiresAt = 0;
let isSigningIn = false;

/**
 * Detect LINE Mini App / LIFF WebView or other restricted in-app browsers
 * where signInWithPopup often fails (blank page after account selection).
 */
function isLikelyInLineWebView(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const liff = (window as unknown as { liff?: { isInClient?: () => boolean } }).liff;
    if (liff && typeof liff.isInClient === "function") {
      return liff.isInClient();
    }
  } catch {
    // ignore
  }
  const ua = navigator.userAgent || "";
  if (/Line\//i.test(ua) || /LIFF/i.test(ua)) return true;
  if (/; wv\)/i.test(ua)) return true;
  if (/iPhone|iPad|iPod/i.test(ua) && !/Safari/i.test(ua)) return true;
  return false;
}

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

export interface GoogleSheetBackupMeta {
  spreadsheetId: string;
  spreadsheetTitle: string;
  spreadsheetUrl: string;
  lastBackupAt: string;
  stats: {
    products: number;
    movements: number;
    orders: number;
    categories: number;
  };
}

export const BACKUP_STORAGE_KEYS = {
  ACTIVE_SHEET_META: "minimark_google_sheet_backup_meta",
  AUTO_SYNC_ENABLED: "minimark_google_sheet_auto_sync",
};

/**
 * Storage helpers for active backup sheet and auto-sync setting
 */
export function getActiveBackupSheetMeta(): GoogleSheetBackupMeta | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(BACKUP_STORAGE_KEYS.ACTIVE_SHEET_META);
    if (!raw) return null;
    return JSON.parse(raw) as GoogleSheetBackupMeta;
  } catch {
    return null;
  }
}

export function saveActiveBackupSheetMeta(meta: GoogleSheetBackupMeta | null): void {
  if (typeof window === "undefined") return;
  if (!meta) {
    localStorage.removeItem(BACKUP_STORAGE_KEYS.ACTIVE_SHEET_META);
  } else {
    localStorage.setItem(BACKUP_STORAGE_KEYS.ACTIVE_SHEET_META, JSON.stringify(meta));
  }
  window.dispatchEvent(new Event("minimark_google_sheet_synced"));
}

export function isAutoSyncToSheetsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(BACKUP_STORAGE_KEYS.AUTO_SYNC_ENABLED) === "true";
}

export function setAutoSyncToSheetsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(BACKUP_STORAGE_KEYS.AUTO_SYNC_ENABLED, enabled ? "true" : "false");
  window.dispatchEvent(new Event("minimark_google_sheet_synced"));
}

/**
 * Initialize auth state listener.
 * Also processes pending redirect result (required for LINE Mini App / WebView).
 * Memory token is cleared immediately on sign out.
 */
export function initGoogleAuth(
  onSuccess?: (user: User, token: string) => void,
  onFailure?: () => void,
): () => void {
  if (!auth) {
    if (onFailure) onFailure();
    return () => {};
  }

  // Complete redirect-based sign-in if we just returned from Google OAuth
  void (async () => {
    try {
      isSigningIn = true;
      const redirectResult = await getRedirectResult(auth);
      if (redirectResult) {
        const credential = GoogleAuthProvider.credentialFromResult(redirectResult);
        if (credential?.accessToken) {
          cachedAccessToken = credential.accessToken;
          if (onSuccess) onSuccess(redirectResult.user, cachedAccessToken);
        }
      }
    } catch (err) {
      console.warn("[GoogleSheets] getRedirectResult failed:", err);
    } finally {
      isSigningIn = false;
    }
  })();

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
 * Trigger Google Sign In and request required Workspace scopes.
 * - Normal browser: signInWithPopup
 * - LINE Mini App / restricted WebView: signInWithRedirect (popup fails with blank page)
 */
export async function signInWithGoogle(): Promise<{ user: User; accessToken: string }> {
  if (!auth) {
    throw new Error(
      "ระบบ Google Sheets Sync ยังไม่ได้กำหนดค่า Firebase Auth หรือ API Key ในสภาพแวดล้อมนี้",
    );
  }
  try {
    isSigningIn = true;

    if (isLikelyInLineWebView()) {
      await signInWithRedirect(auth, provider);
      // Page navigates away; result handled by getRedirectResult in initGoogleAuth
      return new Promise(() => {});
    }

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("ไม่สามารถรับ OAuth Access Token จาก Google ได้");
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err?.code === "auth/popup-closed-by-user") {
      throw new Error("หน้าต่างเข้าสู่ระบบ Google ถูกปิดก่อนทำรายการเสร็จสิ้น");
    }
    if (err?.code === "auth/popup-blocked") {
      try {
        await signInWithRedirect(auth, provider);
        return new Promise(() => {});
      } catch {
        throw new Error(
          "เบราว์เซอร์บล็อกหน้าต่างป็อปอัป กรุณาอนุญาตป็อปอัป หรือเปิดผ่าน LINE Mini App อีกครั้ง",
        );
      }
    }
    if (err?.code === "auth/operation-not-supported-in-this-environment") {
      await signInWithRedirect(auth, provider);
      return new Promise(() => {});
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
}

/**
 * Sign out and clear in-memory credentials
 */
export async function signOutFromGoogle(): Promise<void> {
  if (auth) {
    await signOut(auth);
  }
  cachedAccessToken = null;
  cachedAccessTokenExpiresAt = 0;
}

/**
 * Disconnect Service Account and clear cached tokens
 */
export async function disconnectServiceAccount(): Promise<{ success: boolean; message: string }> {
  try {
    const res = await disconnectGoogleSheetsConfigFn();
    cachedAccessToken = null;
    cachedAccessTokenExpiresAt = 0;
    return res;
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Retrieve active in-memory access token
 */
export function getGoogleAccessToken(): string | null {
  return cachedAccessToken;
}

/**
 * Invalidate cached token immediately
 */
export function invalidateGoogleAccessToken(): void {
  cachedAccessToken = null;
  cachedAccessTokenExpiresAt = 0;
}

/**
 * Resolve effective Google access token (checking Service Account first, then OAuth token)
 * Automatically refreshes token if expired or close to expiry.
 */
export async function resolveAccessToken(token?: string): Promise<string> {
  if (token && token.trim()) return token.trim();
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.trim() && cachedAccessTokenExpiresAt > now + 60_000) {
    return cachedAccessToken.trim();
  }
  try {
    const res = await getGoogleSheetsAccessTokenFn();
    if (res.success && res.token) {
      cachedAccessToken = res.token;
      cachedAccessTokenExpiresAt = now + 3500 * 1000;
      return res.token;
    }
  } catch (err) {
    console.warn("[GoogleSheets] Failed to fetch service account token:", err);
  }
  if (cachedAccessToken && cachedAccessToken.trim()) {
    return cachedAccessToken.trim();
  }
  throw new Error(
    "ต้องเชื่อมต่อ Google Sheets ก่อนดำเนินการ (กรุณากำหนดค่า Service Account หรือเข้าสู่ระบบ Google)",
  );
}

/**
 * Check if a Service Account is configured and return status
 */
export async function checkGoogleSheetsConfig(): Promise<GoogleSheetsConfigStatus> {
  try {
    return await getGoogleSheetsConfigFn();
  } catch {
    return {
      isConfigured: false,
      clientEmail: null,
      spreadsheetId: null,
      source: "none",
    };
  }
}

/**
 * List Google Spreadsheets created by or accessible to this app
 */
export async function listUserSpreadsheets(token?: string): Promise<DriveSpreadsheetFile[]> {
  const activeToken = await resolveAccessToken(token);

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
 * Get spreadsheet details and tab list
 */
export async function getSpreadsheetMetadata(
  spreadsheetId: string,
  token?: string,
): Promise<{ title: string; sheets: SheetTabInfo[]; spreadsheetUrl: string }> {
  const activeToken = await resolveAccessToken(token);

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
  const activeToken = await resolveAccessToken(token);

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
 * Create a new single-tab Google Spreadsheet
 */
export async function createNewSpreadsheet(
  title: string,
  initialSheetTitle: string,
  rows: (string | number)[][],
  token?: string,
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  return createMultiSheetSpreadsheet(
    title,
    [
      {
        title: initialSheetTitle,
        rows,
      },
    ],
    token,
  );
}

/**
 * Create a new Multi-Sheet Google Spreadsheet (for Complete Database Backup)
 */
export async function createMultiSheetSpreadsheet(
  title: string,
  sheetsData: Array<{ title: string; rows: (string | number)[][] }>,
  token?: string,
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const activeToken = await resolveAccessToken(token);

  const body = {
    properties: {
      title,
    },
    sheets: sheetsData.map((s) => ({
      properties: {
        title: s.title,
      },
      data: [
        {
          startRow: 0,
          startColumn: 0,
          rowData: s.rows.map((row) => ({
            values: row.map((val) => ({
              userEnteredValue:
                typeof val === "number" ? { numberValue: val } : { stringValue: String(val ?? "") },
            })),
          })),
        },
      ],
    })),
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
    throw new Error(
      errorData?.error?.message || `Create multi-sheet spreadsheet error: ${res.statusText}`,
    );
  }

  const data = await res.json();
  const spreadsheetId = data.spreadsheetId as string;
  const spreadsheetUrl =
    (data.spreadsheetUrl as string) || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  // Best effort: allow anyone with the link to view/edit (so clicking the link in personal account doesn't trigger 403)
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}/permissions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${activeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: "writer",
        type: "anyone",
      }),
    });
  } catch {
    // ignore
  }

  return {
    spreadsheetId,
    spreadsheetUrl,
  };
}

/**
 * Update/Overwrite range in an existing spreadsheet
 */
export async function updateSpreadsheetRange(
  spreadsheetId: string,
  range: string,
  values: (string | number)[][],
  token?: string,
): Promise<{ updatedRows: number; updatedColumns: number }> {
  const activeToken = await resolveAccessToken(token);

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
 * Batch update multiple sheets/ranges in a single API call
 */
export async function batchUpdateSpreadsheetValues(
  spreadsheetId: string,
  data: Array<{ range: string; values: (string | number)[][] }>,
  token?: string,
): Promise<void> {
  const activeToken = token || cachedAccessToken;
  if (!activeToken) {
    throw new Error("ต้องเข้าสู่ระบบ Google ก่อนดำเนินการ");
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${activeToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      valueInputOption: "USER_ENTERED",
      data,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData?.error?.message || `Batch update spreadsheet error: ${res.statusText}`,
    );
  }
}

/**
 * Ensure sheet tabs exist in an existing spreadsheet; add missing tabs
 */
export async function ensureSheetTabsExist(
  spreadsheetId: string,
  requiredTabTitles: string[],
  token?: string,
): Promise<void> {
  const activeToken = token || cachedAccessToken;
  if (!activeToken) {
    throw new Error("ต้องเข้าสู่ระบบ Google ก่อนดำเนินการ");
  }

  const meta = await getSpreadsheetMetadata(spreadsheetId, activeToken);
  const existingTabTitles = new Set(meta.sheets.map((s) => s.title));

  const missingTabs = requiredTabTitles.filter((t) => !existingTabTitles.has(t));
  if (missingTabs.length === 0) return;

  const requests = missingTabs.map((title) => ({
    addSheet: {
      properties: {
        title,
      },
    },
  }));

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${activeToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requests }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    console.warn("Could not add missing tabs:", errorData);
  }
}

/**
 * Helper: Build Overview & Summary Sheet Rows
 */
export function buildOverviewExportRows(backupPackage: BackupPackage): (string | number)[][] {
  const { metadata } = backupPackage;
  return [
    ["📊 ฐานข้อมูลสำรองร้านค้า (MiniMark Store Backup Database)"],
    ["อัปเดตข้อมูลล่าสุดเมื่อ", metadata.createdAtThai, "ISO Timestamp", metadata.createdAt],
    ["ชื่อร้านค้า (Store Name)", metadata.storeName],
    ["สาขา (Branch)", metadata.branchName],
    ["ผู้ส่งออกข้อมูล (Exported By)", metadata.exportedBy],
    ["เวอร์ชันโครงสร้าง (Version)", metadata.version],
    [""],
    ["📈 สรุปตัวเลขสถิติฐานข้อมูล (Database Summary Statistics)"],
    ["รายการสถิติ", "จำนวน / มูลค่า", "หน่วยนับ"],
    ["จำนวนสินค้าทั้งหมด (Total Products)", metadata.totalProducts, "รายการ"],
    ["ยอดสต็อกสินค้ารวม (Total Stock)", metadata.totalStockUnits, "ชิ้น"],
    ["ประวัติการสั่งซื้อ (Total Purchase Orders)", metadata.totalOrders, "ใบสั่งซื้อ"],
    ["ประวัติการเคลื่อนไหวสต็อก (Stock Movements)", metadata.totalMovements, "รายการ"],
    ["จำนวนผู้ใช้งานระบบ (Total Users)", metadata.totalUsers, "บัญชี"],
    [""],
    ["ℹ️ คำแนะนำการใช้งานฐานข้อมูลสำรอง Google Sheets"],
    ["แท็บ 1: สรุปภาพรวม - สรุปข้อมูลร้านค้าและตัวเลขสถิติทั้งหมด"],
    ["แท็บ 2: สินค้า - รายการสินค้า บาร์โค้ด ราคาขาย ราคาต้นทุน และสต็อกปัจจุบัน"],
    ["แท็บ 3: การเคลื่อนไหวสต็อก - บันทึกประวัติการรับเข้า เบิกออก และปรับยอด"],
    ["แท็บ 4: ใบสั่งซื้อ - รายการใบสั่งซื้อสินค้า PO และซัพพลายเออร์"],
    ["แท็บ 5: ข้อมูลหลัก - หมวดหมู่ หมวดหมู่ย่อย โซนจัดเก็บ และหน่วยนับ"],
    ["แท็บ 6: สำรองดิบ_JSON - ข้อมูลดิบสำหรับกู้คืนกลับสู่ระบบได้ 100% ครบทุกโครงสร้าง"],
  ];
}

/**
 * Helper: Build Product Inventory Sheet Rows
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
    "กำไรต่อชิ้น (Profit)",
    "สต็อกปัจจุบัน (Current Stock)",
    "มูลค่าสต็อกต้นทุน (Total Cost Value)",
    "จุดสั่งซื้อขั้นต่ำ (Min Stock)",
    "สต็อกเป้าหมาย (Target Stock)",
    "ปริมาณสั่งซื้อแนะนำ (Reorder Qty)",
    "สถานะ (Status)",
    "อัปเดตล่าสุด (Updated At)",
  ];

  const dataRows = products.map((p) => {
    const profit = Math.round((p.sellPrice - p.costPrice) * 100) / 100;
    const totalCostValue = Math.round(p.stock * p.costPrice * 100) / 100;
    return [
      p.barcode,
      p.sku,
      p.name,
      getCatName(p.categoryId),
      getSubCatName(p.subCategoryId),
      getZoneName(p.zoneId),
      getUnitName(p.unitId),
      p.costPrice,
      p.sellPrice,
      profit,
      p.stock,
      totalCostValue,
      p.minStock,
      p.targetStock,
      p.reorderQuantity,
      p.isActive ? "เปิดขายปกติ" : "ระงับชั่วคราว",
      p.updatedAt || new Date().toISOString(),
    ];
  });

  return [headers, ...dataRows];
}

/**
 * Helper: Build Stock Movement Sheet Rows
 */
export function buildStockMovementExportRows(movements: StockMovementLog[]): (string | number)[][] {
  const headers = [
    "วันที่และเวลา (Timestamp)",
    "รหัสบันทึก (Log ID)",
    "ประเภทธุรกรรม (Type)",
    "ชื่อสินค้า (Product Name)",
    "บาร์โค้ด (Barcode)",
    "จำนวน (Quantity)",
    "สต็อกก่อนหน้า (Previous Stock)",
    "สต็อกคงเหลือใหม่ (New Stock)",
    "ผู้ทำรายการ (Operator)",
    "หมายเหตุ (Note)",
  ];

  const typeMap: Record<string, string> = {
    RECEIVE: "รับสินค้าเข้า",
    ISSUE: "เบิก/ขายสินค้าออก",
    ADJUST: "ปรับยอดตรวจนับ",
    INITIAL: "ยอดยกมาเริ่มต้น",
  };

  const dataRows = movements.map((m) => [
    m.timestamp,
    m.id,
    typeMap[m.type] || m.type,
    m.productName,
    m.barcode,
    m.quantity,
    m.previousStock,
    m.newStock,
    m.operator,
    m.note || "-",
  ]);

  return [headers, ...dataRows];
}

/**
 * Helper: Build Purchase Order Sheet Rows
 */
export function buildPurchaseOrderExportRows(orders: PurchaseOrderRecord[]): (string | number)[][] {
  const headers = [
    "เลขที่ใบสั่งซื้อ (PO Number)",
    "วันที่สั่งซื้อ (Created At)",
    "ซัพพลายเออร์ (Supplier)",
    "สถานะ (Status)",
    "จำนวนรายการสินค้า (Line Items)",
    "ยอดชิ้นรวม (Total Qty)",
    "ยอดเงินรวมบาท (Total Cost)",
    "ส่งทาง LINE เมื่อ (LINE Sent At)",
    "รายการสินค้าโดยสรุป (Items Summary)",
  ];

  const statusMap: Record<string, string> = {
    DRAFT: "ฉบับร่าง",
    ORDERED: "สั่งซื้อแล้ว",
    RECEIVED: "รับสินค้าแล้ว",
    CANCELLED: "ยกเลิก",
  };

  const dataRows = orders.map((o) => {
    const itemsSummary = (o.items || [])
      .map((item) => `${item.productName} (${item.quantity} ${item.unitName})`)
      .join(", ");
    return [
      o.orderNumber,
      o.createdAt,
      o.supplierName || "-",
      statusMap[o.status] || o.status,
      o.items?.length || 0,
      o.totalQuantity,
      o.totalCost,
      o.sentViaLineAt || "-",
      itemsSummary || "-",
    ];
  });

  return [headers, ...dataRows];
}

/**
 * Helper: Build Master Data Sheet Rows (Categories, Subcategories, Zones, Units)
 */
export function buildMasterDataExportRows(): (string | number)[][] {
  const categories = MasterStore.getCategories();
  const subCategories = MasterStore.getSubCategories();
  const zones = MasterStore.getZones();
  const units = MasterStore.getUnits();

  const rows: (string | number)[][] = [
    ["🏷️ ข้อมูลหลักของระบบ (Master Data Categories & Classifications)"],
    [""],
    ["=== 1. หมวดหมู่สินค้าหลัก (Categories) ==="],
    ["รหัสหมวดหมู่ (ID)", "รหัสย่อ (Code)", "ชื่อหมวดหมู่ (Category Name)"],
    ...categories.map((c) => [c.id, c.code, c.name]),
    [""],
    ["=== 2. หมวดหมู่สินค้าย่อย (Subcategories) ==="],
    ["รหัสหมวดย่อย (ID)", "รหัสหมวดหลัก (Cat ID)", "รหัสย่อ (Code)", "ชื่อหมวดย่อย (Name)"],
    ...subCategories.map((sc) => [sc.id, sc.categoryId, sc.code, sc.name]),
    [""],
    ["=== 3. โซนจัดเก็บสินค้า (Storage Zones) ==="],
    ["รหัสโซน (ID)", "รหัสย่อ (Code)", "ชื่อโซน (Zone Name)", "คำอธิบาย (Description)"],
    ...zones.map((z) => [z.id, z.code, z.name, z.description || "-"]),
    [""],
    ["=== 4. หน่วยนับสินค้า (Units) ==="],
    ["รหัสหน่วย (ID)", "ชื่อหน่วยนับ (Unit Name)", "ชื่อย่อ (Short Name)"],
    ...units.map((u) => [u.id, u.name, u.shortName]),
  ];

  return rows;
}

/**
 * Helper: Build Raw Backup JSON Sheet Rows (for 100% loss-free backup & restore)
 */
export function buildRawBackupRows(backupPackage: BackupPackage): (string | number)[][] {
  const jsonStr = JSON.stringify(backupPackage);
  return [
    ["⚙️ ข้อมูลสำรองเชิงลึก (Raw JSON Payload) - ห้ามแก้ไขข้อมูลในแถวที่ 2 โดยตรง"],
    [jsonStr],
  ];
}

/**
 * TAB NAMES FOR COMPLETE BACKUP SPREADSHEET
 */
export const BACKUP_SHEET_TABS = {
  OVERVIEW: "📊 สรุปภาพรวม",
  PRODUCTS: "📦 สินค้า",
  MOVEMENTS: "📝 การเคลื่อนไหวสต็อก",
  ORDERS: "📋 ใบสั่งซื้อ",
  MASTER: "🏷️ ข้อมูลหลัก",
  RAW_JSON: "⚙️ สำรองดิบ_JSON",
};

/**
 * Complete Database Backup: Exports all store collections into Google Sheets
 */
export async function backupFullDatabaseToGoogleSheets(options?: {
  spreadsheetId?: string;
  spreadsheetTitle?: string;
  token?: string;
}): Promise<GoogleSheetBackupMeta> {
  const activeToken = await resolveAccessToken(options?.token);

  // Pre-fetch latest data from Cloud SQL / server if available to ensure complete unified backup
  try {
    const cloudSqlRes = await fetchCloudSqlSnapshotFn();
    if (cloudSqlRes && cloudSqlRes.data) {
      MasterStore.syncDatabaseSnapshot(
        cloudSqlRes.data as Parameters<typeof MasterStore.syncDatabaseSnapshot>[0],
      );
    }
  } catch (err) {
    console.warn(
      "Could not pre-fetch Cloud SQL snapshot, proceeding with current store state:",
      err,
    );
  }

  const receiptConfig = PrinterService.getReceiptConfig();
  const backupPackage = BackupService.generateBackupPackage({
    includeTransactions: true,
    includePrinters: true,
    includeStaff: true,
  });

  const overviewRows = buildOverviewExportRows(backupPackage);
  const productRows = buildProductExportRows(backupPackage.data.products);
  const movementRows = buildStockMovementExportRows(backupPackage.data.movements);
  const orderRows = buildPurchaseOrderExportRows(backupPackage.data.purchaseOrders);
  const masterRows = buildMasterDataExportRows();
  const rawRows = buildRawBackupRows(backupPackage);

  const sheetsData = [
    { title: BACKUP_SHEET_TABS.OVERVIEW, rows: overviewRows },
    { title: BACKUP_SHEET_TABS.PRODUCTS, rows: productRows },
    { title: BACKUP_SHEET_TABS.MOVEMENTS, rows: movementRows },
    { title: BACKUP_SHEET_TABS.ORDERS, rows: orderRows },
    { title: BACKUP_SHEET_TABS.MASTER, rows: masterRows },
    { title: BACKUP_SHEET_TABS.RAW_JSON, rows: rawRows },
  ];

  // 1. If using server credentials (no personal OAuth token passed), attempt server-side backup first
  if (!options?.token) {
    try {
      const serverRes = await triggerServerBackupToGoogleSheetsFn({
        data: { spreadsheetId: options?.spreadsheetId },
      });
      if (serverRes.success && serverRes.spreadsheetId && serverRes.spreadsheetUrl) {
        const resultMeta: GoogleSheetBackupMeta = {
          spreadsheetId: serverRes.spreadsheetId,
          spreadsheetTitle: serverRes.spreadsheetTitle || "Google Sheet",
          spreadsheetUrl: serverRes.spreadsheetUrl,
          lastBackupAt: serverRes.backedUpAt || new Date().toISOString(),
          stats: {
            products: serverRes.stats?.products ?? backupPackage.data.products.length,
            movements: serverRes.stats?.movements ?? backupPackage.data.movements.length,
            orders: serverRes.stats?.orders ?? backupPackage.data.purchaseOrders.length,
            categories: serverRes.stats?.categories ?? backupPackage.data.categories.length,
          },
        };
        saveActiveBackupSheetMeta(resultMeta);
        return resultMeta;
      }
    } catch (serverErr) {
      console.warn("[GoogleSheets] Server backup notice, continuing with direct sync:", serverErr);
    }
  }

  // 2. Resolve target spreadsheet ID (from options, local meta, or server env)
  let targetId = options?.spreadsheetId || getActiveBackupSheetMeta()?.spreadsheetId;
  if (!targetId) {
    try {
      const saCfg = await checkGoogleSheetsConfig();
      if (saCfg?.spreadsheetId) {
        targetId = saCfg.spreadsheetId;
      }
    } catch {
      // ignore
    }
  }

  let finalId = "";
  let finalUrl = "";
  let finalTitle = "";

  if (targetId) {
    // Overwrite existing backup spreadsheet
    finalId = targetId;
    const requiredTabs = [
      BACKUP_SHEET_TABS.OVERVIEW,
      BACKUP_SHEET_TABS.PRODUCTS,
      BACKUP_SHEET_TABS.MOVEMENTS,
      BACKUP_SHEET_TABS.ORDERS,
      BACKUP_SHEET_TABS.MASTER,
      BACKUP_SHEET_TABS.RAW_JSON,
    ];
    await ensureSheetTabsExist(finalId, requiredTabs, activeToken);

    const batchData = sheetsData.map((s) => ({
      range: `'${s.title}'!A1`,
      values: s.rows,
    }));
    await batchUpdateSpreadsheetValues(finalId, batchData, activeToken);

    const meta = await getSpreadsheetMetadata(finalId, activeToken);
    finalTitle = meta.title;
    finalUrl = meta.spreadsheetUrl;
  } else {
    // Create new multi-sheet spreadsheet
    const now = new Date();
    const dateStr = now.toLocaleDateString("th-TH").replace(/\//g, "-");
    const defaultTitle = `${receiptConfig.storeName || "โชห่วยยุค90s"} - ฐานข้อมูลสำรอง (${dateStr})`;
    const title = options?.spreadsheetTitle?.trim() || defaultTitle;

    const res = await createMultiSheetSpreadsheet(title, sheetsData, activeToken);
    finalId = res.spreadsheetId;
    finalUrl = res.spreadsheetUrl;
    finalTitle = title;
  }

  const resultMeta: GoogleSheetBackupMeta = {
    spreadsheetId: finalId,
    spreadsheetTitle: finalTitle,
    spreadsheetUrl: finalUrl,
    lastBackupAt: new Date().toISOString(),
    stats: {
      products: backupPackage.data.products.length,
      movements: backupPackage.data.movements.length,
      orders: backupPackage.data.purchaseOrders.length,
      categories: backupPackage.data.categories.length,
    },
  };

  saveActiveBackupSheetMeta(resultMeta);
  return resultMeta;
}

/**
 * Complete Database Restore from Google Sheets
 * Reads raw JSON payload or product data from Google Sheet and restores store
 */
export async function restoreFullDatabaseFromGoogleSheets(
  spreadsheetId: string,
  token?: string,
): Promise<{
  success: boolean;
  message: string;
  stats: { products: number; orders: number; movements: number };
}> {
  const activeToken = await resolveAccessToken(token);

  // 1. Try reading Raw JSON sheet first (full fidelity restore)
  try {
    const rawValues = await readSpreadsheetValues(
      spreadsheetId,
      `'${BACKUP_SHEET_TABS.RAW_JSON}'!A2`,
      activeToken,
    );
    const rawJsonStr = rawValues?.[0]?.[0];

    if (rawJsonStr && rawJsonStr.trim().startsWith("{")) {
      const validation = BackupService.validateBackupFile(rawJsonStr);
      if (validation.isValid && validation.package) {
        const restoreRes = BackupService.restoreBackup(validation.package, "OVERWRITE");
        if (restoreRes.success) {
          return {
            success: true,
            message: `กู้คืนข้อมูลครบถ้วนจาก Google Sheets สำเร็จ (${restoreRes.stats.products} สินค้า, ${restoreRes.stats.orders} ใบสั่งซื้อ)`,
            stats: restoreRes.stats,
          };
        }
      }
    }
  } catch {
    // Raw JSON tab not found or unreadable, fall back to parsing products tab
  }

  // 2. Fallback: Parse Products tab
  const productValues = await readSpreadsheetValues(
    spreadsheetId,
    `'${BACKUP_SHEET_TABS.PRODUCTS}'!A1:Q`,
    activeToken,
  );

  if (!productValues || productValues.length < 2) {
    throw new Error("ไม่พบข้อมูลสินค้าหรือข้อมูลดิบที่สามารถกู้คืนได้ในสเปรดชีตนี้");
  }

  const headers = productValues[0].map((h) => h.trim().toLowerCase());
  const barcodeIdx = headers.findIndex((h) => h.includes("บาร์โค้ด") || h.includes("barcode"));
  const nameIdx = headers.findIndex((h) => h.includes("ชื่อ") || h.includes("name"));
  const costIdx = headers.findIndex((h) => h.includes("ต้นทุน") || h.includes("cost"));
  const priceIdx = headers.findIndex((h) => h.includes("ขาย") || h.includes("price"));
  const stockIdx = headers.findIndex((h) => h.includes("สต็อกปัจจุบัน") || h.includes("stock"));

  if (barcodeIdx === -1 || nameIdx === -1) {
    throw new Error("รูปแบบคอลัมน์ในแท็บสินค้าไม่ถูกต้อง ขาดคอลัมน์บาร์โค้ดหรือชื่อสินค้า");
  }

  let count = 0;
  const currentProducts = MasterStore.getProducts();
  const categories = MasterStore.getCategories();
  const units = MasterStore.getUnits();
  const defaultCatId = categories[0]?.id || "cat-food";
  const defaultUnitId = units[0]?.id || "unit-piece";

  for (let i = 1; i < productValues.length; i++) {
    const row = productValues[i];
    const barcode = row[barcodeIdx]?.trim();
    const name = row[nameIdx]?.trim();
    if (!barcode || !name) continue;

    const cost = costIdx >= 0 ? parseFloat(row[costIdx]) || 0 : 0;
    const price = priceIdx >= 0 ? parseFloat(row[priceIdx]) || 0 : 0;
    const stock = stockIdx >= 0 ? parseInt(row[stockIdx], 10) || 0 : 0;

    const existing = currentProducts.find((p) => p.barcode === barcode);
    if (existing) {
      MasterStore.updateProduct(existing.id, {
        name,
        costPrice: cost > 0 ? cost : existing.costPrice,
        sellPrice: price > 0 ? price : existing.sellPrice,
        stock: stock >= 0 ? stock : existing.stock,
      });
    } else {
      MasterStore.addProduct({
        barcode,
        sku: barcode.slice(-6).toUpperCase(),
        name,
        codeType: "Barcode",
        format: "EAN_13",
        categoryId: defaultCatId,
        unitId: defaultUnitId,
        costPrice: cost,
        sellPrice: price,
        stock: stock,
        minStock: 5,
        targetStock: 15,
        reorderQuantity: 15,
        isActive: true,
      });
    }
    count++;
  }

  return {
    success: true,
    message: `กู้คืนรายการสินค้าจาก Google Sheets สำเร็จ ${count} รายการ`,
    stats: {
      products: count,
      orders: 0,
      movements: 0,
    },
  };
}

/**
 * Setup debounced auto-sync to Google Sheets on local store changes
 */
let autoSyncTimer: ReturnType<typeof setTimeout> | null = null;
let isAutoSyncing = false;

if (typeof window !== "undefined") {
  window.addEventListener("minimark_store_change", () => {
    if (!isAutoSyncToSheetsEnabled()) return;
    if (!cachedAccessToken) return;
    const activeMeta = getActiveBackupSheetMeta();
    if (!activeMeta?.spreadsheetId) return;

    if (autoSyncTimer) clearTimeout(autoSyncTimer);
    autoSyncTimer = setTimeout(async () => {
      if (isAutoSyncing) return;
      isAutoSyncing = true;
      try {
        await backupFullDatabaseToGoogleSheets({
          spreadsheetId: activeMeta.spreadsheetId,
          token: cachedAccessToken || undefined,
        });
      } catch (err) {
        console.warn("[Google Sheets AutoSync] Error:", err);
      } finally {
        isAutoSyncing = false;
      }
    }, 8000); // Debounce 8 seconds
  });
}

export interface MigrationSummary {
  success: boolean;
  message: string;
  cloudSqlSource: "cloudsql" | "memory";
  counts: {
    products: number;
    movements: number;
    orders: number;
    categories: number;
    zones: number;
    units: number;
  };
  spreadsheetId: string;
  spreadsheetTitle: string;
  spreadsheetUrl: string;
}

/**
 * Migration Engine: Unifies data from Cloud SQL, Server Memory, and Local Storage,
 * then saves and exports everything into Google Sheets as a backup database.
 */
export async function migrateAllSourcesToGoogleSheets(options?: {
  spreadsheetId?: string;
  spreadsheetTitle?: string;
  token?: string;
}): Promise<MigrationSummary> {
  const activeToken = await resolveAccessToken(options?.token);

  // 1. Fetch Cloud SQL snapshot from server
  let cloudSqlData: {
    products?: Array<Record<string, unknown>>;
    categories?: Array<{ id: string; code?: string; name?: string }>;
    subCategories?: Array<{ id: string; categoryId: string; code?: string; name?: string }>;
    zones?: Array<{ id: string; code?: string; name?: string; description?: string }>;
    units?: Array<{ id: string; name?: string; shortName?: string }>;
    movements?: Array<Record<string, unknown>>;
    purchaseOrders?: Array<Record<string, unknown>>;
  } | null = null;
  let source: "cloudsql" | "memory" = "memory";

  try {
    const res = await fetchCloudSqlSnapshotFn();
    if (res && res.data) {
      cloudSqlData = res.data as typeof cloudSqlData;
      source = res.source;
    }
  } catch (err) {
    console.warn("Could not fetch server snapshot, continuing with local store:", err);
  }

  // 2. Merge Products (Keep unique by barcode or SKU)
  const localProducts = MasterStore.getProducts();
  const productMap = new Map<string, ProductItem>();
  localProducts.forEach((p) => {
    const key = p.barcode || p.sku || p.id;
    if (key) productMap.set(key, p);
  });

  if (cloudSqlData?.products && Array.isArray(cloudSqlData.products)) {
    cloudSqlData.products.forEach((p) => {
      const key = String(p["barcode"] || p["sku"] || p["id"] || "");
      if (key && !productMap.has(key)) {
        productMap.set(key, {
          id: String(p["id"] || `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
          sku: String(p["sku"] || p["barcode"] || "SKU"),
          barcode: String(p["barcode"] || p["sku"] || ""),
          codeType: (p["codeType"] as "QR" | "Barcode") || "Barcode",
          format: p["format"] ? String(p["format"]) : "EAN_13",
          name: String(p["name"] || "สินค้าไม่ระบุชื่อ"),
          imageUrl: p["imageUrl"] ? String(p["imageUrl"]) : undefined,
          categoryId: String(p["categoryId"] || "cat-food"),
          subCategoryId: p["subCategoryId"] ? String(p["subCategoryId"]) : undefined,
          zoneId: p["zoneId"] ? String(p["zoneId"]) : undefined,
          unitId: String(p["unitId"] || "unit-piece"),
          costPrice: Number(p["costPrice"]) || 0,
          sellPrice: Number(p["sellPrice"]) || 0,
          stock: Number(p["stock"]) || 0,
          minStock: Number(p["minStock"]) || 5,
          targetStock: Number(p["targetStock"]) || 15,
          reorderQuantity: Number(p["reorderQuantity"]) || 15,
          isActive: p["isActive"] !== false,
          createdAt: String(p["createdAt"] || new Date().toISOString()),
          updatedAt: String(p["updatedAt"] || new Date().toISOString()),
        });
      }
    });
  }
  const mergedProducts = [...productMap.values()];
  if (mergedProducts.length > 0) {
    MasterStore.saveProducts(mergedProducts);
  }

  // 3. Merge Categories
  const localCats = MasterStore.getCategories();
  const catMap = new Map<string, (typeof localCats)[0]>();
  localCats.forEach((c) => catMap.set(c.id, c));
  if (cloudSqlData?.categories && Array.isArray(cloudSqlData.categories)) {
    cloudSqlData.categories.forEach((c) => {
      if (c.id && !catMap.has(c.id)) {
        catMap.set(c.id, {
          id: c.id,
          code: c.code || "CAT",
          name: c.name || "หมวดหมู่",
        });
      }
    });
  }
  const mergedCats = [...catMap.values()];
  if (mergedCats.length > 0) {
    MasterStore.saveCategories(mergedCats);
  }

  // 4. Merge Subcategories
  const localSubCats = MasterStore.getSubCategories();
  const subCatMap = new Map<string, (typeof localSubCats)[0]>();
  localSubCats.forEach((sc) => subCatMap.set(sc.id, sc));
  if (cloudSqlData?.subCategories && Array.isArray(cloudSqlData.subCategories)) {
    cloudSqlData.subCategories.forEach((sc) => {
      if (sc.id && !subCatMap.has(sc.id)) {
        subCatMap.set(sc.id, {
          id: sc.id,
          categoryId: sc.categoryId,
          code: sc.code || "SUB",
          name: sc.name || "หมวดหมู่ย่อย",
        });
      }
    });
  }
  const mergedSubCats = [...subCatMap.values()];
  if (mergedSubCats.length > 0) {
    MasterStore.saveSubCategories(mergedSubCats);
  }

  // 5. Merge Zones & Units
  const localZones = MasterStore.getZones();
  const zoneMap = new Map<string, (typeof localZones)[0]>();
  localZones.forEach((z) => zoneMap.set(z.id, z));
  if (cloudSqlData?.zones && Array.isArray(cloudSqlData.zones)) {
    cloudSqlData.zones.forEach((z) => {
      if (z.id && !zoneMap.has(z.id)) {
        zoneMap.set(z.id, {
          id: z.id,
          code: z.code || "ZONE",
          name: z.name || "โซน",
          description: z.description,
        });
      }
    });
  }
  const mergedZones = [...zoneMap.values()];
  if (mergedZones.length > 0) MasterStore.saveZones(mergedZones);

  const localUnits = MasterStore.getUnits();
  const unitMap = new Map<string, (typeof localUnits)[0]>();
  localUnits.forEach((u) => unitMap.set(u.id, u));
  if (cloudSqlData?.units && Array.isArray(cloudSqlData.units)) {
    cloudSqlData.units.forEach((u) => {
      if (u.id && !unitMap.has(u.id)) {
        unitMap.set(u.id, {
          id: u.id,
          name: u.name || "ชิ้น",
          shortName: u.shortName || u.name || "ชิ้น",
        });
      }
    });
  }
  const mergedUnits = [...unitMap.values()];
  if (mergedUnits.length > 0) MasterStore.saveUnits(mergedUnits);

  // 6. Merge Stock Movements
  const localMovements = MasterStore.getMovements();
  const moveMap = new Map<string, (typeof localMovements)[0]>();
  localMovements.forEach((m) => moveMap.set(m.id, m));
  if (cloudSqlData?.movements && Array.isArray(cloudSqlData.movements)) {
    cloudSqlData.movements.forEach((m) => {
      const id = String(m["id"] || "");
      if (id && !moveMap.has(id)) {
        moveMap.set(id, {
          id,
          timestamp: String(m["timestamp"] || new Date().toISOString()),
          productId: String(m["productId"] || ""),
          productName: String(m["productName"] || ""),
          barcode: String(m["barcode"] || ""),
          type: (m["type"] as StockMovementLog["type"]) || "ADJUST",
          quantity: Number(m["quantity"]) || 0,
          previousStock: Number(m["previousStock"]) || 0,
          newStock: Number(m["newStock"]) || 0,
          operator: String(m["operator"] || "System"),
          note: m["note"] ? String(m["note"]) : undefined,
        });
      }
    });
  }
  const mergedMovements = [...moveMap.values()];
  if (mergedMovements.length > 0) MasterStore.saveMovements(mergedMovements);

  // 7. Merge Purchase Orders
  const localPOs = MasterStore.getPurchaseOrders();
  const poMap = new Map<string, (typeof localPOs)[0]>();
  localPOs.forEach((po) => poMap.set(po.id, po));
  if (cloudSqlData?.purchaseOrders && Array.isArray(cloudSqlData.purchaseOrders)) {
    cloudSqlData.purchaseOrders.forEach((po) => {
      const id = String(po["id"] || "");
      if (id && !poMap.has(id)) {
        poMap.set(id, {
          id,
          orderNumber: String(po["orderNumber"] || `PO-${Date.now()}`),
          createdAt: String(po["createdAt"] || new Date().toISOString()),
          supplierName: po["supplierName"] ? String(po["supplierName"]) : undefined,
          items: Array.isArray(po["items"]) ? (po["items"] as PurchaseOrderRecord["items"]) : [],
          totalQuantity: Number(po["totalQuantity"]) || 0,
          totalCost: Number(po["totalCost"]) || 0,
          status: (po["status"] as PurchaseOrderRecord["status"]) || "DRAFT",
          sentViaLineAt: po["sentViaLineAt"] ? String(po["sentViaLineAt"]) : undefined,
        });
      }
    });
  }
  const mergedPOs = [...poMap.values()];
  if (mergedPOs.length > 0) MasterStore.savePurchaseOrders(mergedPOs);

  // Trigger UI store updates
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("minimark_store_change"));
  }

  // 8. Write complete unified dataset across all 6 tabs in Google Sheets
  const receiptConfig = PrinterService.getReceiptConfig();
  const dateStr = new Date().toLocaleDateString("th-TH").replace(/\//g, "-");
  const defaultTitle = `${receiptConfig.storeName || "โชห่วยยุค90s"} - ฐานข้อมูล Cloud SQL & Local รวม (${dateStr})`;

  const backupMeta = await backupFullDatabaseToGoogleSheets({
    spreadsheetId: options?.spreadsheetId,
    spreadsheetTitle: options?.spreadsheetTitle || defaultTitle,
    token: activeToken,
  });

  return {
    success: true,
    message: `ย้ายข้อมูลจาก Cloud SQL และ Local เข้าสู่ Google Sheets สำเร็จ (${mergedProducts.length} สินค้า, ${mergedMovements.length} ประวัติสต็อก, ${mergedPOs.length} ใบสั่งซื้อ)`,
    cloudSqlSource: source,
    counts: {
      products: mergedProducts.length,
      movements: mergedMovements.length,
      orders: mergedPOs.length,
      categories: mergedCats.length,
      zones: mergedZones.length,
      units: mergedUnits.length,
    },
    spreadsheetId: backupMeta.spreadsheetId,
    spreadsheetTitle: backupMeta.spreadsheetTitle,
    spreadsheetUrl: backupMeta.spreadsheetUrl,
  };
}
