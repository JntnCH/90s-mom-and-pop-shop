import { createServerFn } from "@tanstack/react-start";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getDatabaseSnapshot } from "../db/db-service.ts";
import { getD1Snapshot } from "../db/d1-snapshot.ts";

export interface ServiceAccountCredentials {
  clientEmail: string;
  privateKey: string;
  projectId?: string;
  spreadsheetId?: string;
}

export interface GoogleSheetsConfigStatus {
  isConfigured: boolean;
  clientEmail: string | null;
  spreadsheetId: string | null;
  source: "env" | "file" | "runtime" | "none";
  projectId?: string | null;
}

// In-memory runtime cache for Service Account config and access token
let runtimeServiceAccount: ServiceAccountCredentials | null = null;
let cachedServiceAccountToken: {
  token: string;
  expiresAt: number;
} | null = null;

const PERSISTENT_CONFIG_DIR = path.join(process.cwd(), ".data");
const PERSISTENT_CONFIG_PATH = path.join(PERSISTENT_CONFIG_DIR, "google-service-account.json");

function readPersistedConfig(): ServiceAccountCredentials | null {
  try {
    if (
      typeof fs !== "undefined" &&
      typeof fs.existsSync === "function" &&
      fs.existsSync(PERSISTENT_CONFIG_PATH)
    ) {
      const raw = fs.readFileSync(PERSISTENT_CONFIG_PATH, "utf8");
      const parsed = JSON.parse(raw) as Partial<ServiceAccountCredentials>;
      if (parsed.clientEmail && parsed.privateKey) {
        return {
          clientEmail: parsed.clientEmail.trim(),
          privateKey: parsed.privateKey.trim(),
          projectId: parsed.projectId?.trim(),
          spreadsheetId: parsed.spreadsheetId?.trim(),
        };
      }
    }
  } catch (err) {
    console.warn("[GoogleSheets] Failed to read persisted credentials:", err);
  }
  return null;
}

function writePersistedConfig(creds: ServiceAccountCredentials | null): void {
  try {
    if (
      typeof fs === "undefined" ||
      typeof fs.existsSync !== "function" ||
      typeof fs.writeFileSync !== "function"
    ) {
      return;
    }
    if (!creds) {
      if (fs.existsSync(PERSISTENT_CONFIG_PATH)) {
        fs.unlinkSync(PERSISTENT_CONFIG_PATH);
      }
      return;
    }
    if (!fs.existsSync(PERSISTENT_CONFIG_DIR)) {
      fs.mkdirSync(PERSISTENT_CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(PERSISTENT_CONFIG_PATH, JSON.stringify(creds, null, 2), "utf8");
  } catch (err) {
    console.warn("[GoogleSheets] Failed to persist credentials to file:", err);
  }
}

function base64url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

/**
 * Read environment variable or Cloudflare Worker binding
 */
async function getBindingOrEnv(key: string): Promise<string> {
  if (typeof process !== "undefined" && process.env && process.env[key]) {
    const val = process.env[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  try {
    const g = globalThis as unknown as Record<string, unknown>;
    const workerEnv = (g["__worker_env__"] || g["__env__"]) as Record<string, unknown> | undefined;
    if (workerEnv && workerEnv[key]) {
      const val = workerEnv[key];
      if (typeof val === "string" && val.trim()) return val.trim();
    }
  } catch {
    // ignore
  }
  try {
    const modName = "cloudflare" + ":workers";
    const mod = (await import(/* @vite-ignore */ modName)) as {
      env?: Record<string, unknown>;
    };
    const workerEnv = mod?.env;
    if (workerEnv && workerEnv[key]) {
      const val = workerEnv[key];
      if (typeof val === "string" && val.trim()) return val.trim();
    }
  } catch {
    // Not running inside Cloudflare Workers or binding not found
  }
  return "";
}

/**
 * Extract Spreadsheet ID from raw ID or full Google Sheets URL
 */
export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

/**
 * Clean and normalize RSA Private Key from various formats (raw, escaped newlines, quoted)
 */
function normalizePrivateKey(rawKey: string): string {
  let key = rawKey.trim();
  // Strip wrapping double or single quotes if present
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  // Convert escaped newlines to real newlines
  key = key.replace(/\\n/g, "\n");
  // Normalize Windows CRLF to LF
  key = key.replace(/\r\n/g, "\n");
  return key.trim();
}

/**
 * Resolve Service Account credentials from Environment (GitHub Secrets, Cloudflare Workers, Node) or Runtime config
 */
async function resolveServiceAccount(): Promise<ServiceAccountCredentials | null> {
  if (runtimeServiceAccount?.clientEmail && runtimeServiceAccount?.privateKey) {
    return runtimeServiceAccount;
  }

  // 1. Check persisted config on disk (.data/google-service-account.json)
  const persisted = readPersistedConfig();
  if (persisted?.clientEmail && persisted?.privateKey) {
    runtimeServiceAccount = {
      ...persisted,
      privateKey: normalizePrivateKey(persisted.privateKey),
    };
    return runtimeServiceAccount;
  }

  // 2. Check GOOGLE_SERVICE_ACCOUNT_JSON and aliases (from GitHub Secrets, process.env, or Cloudflare Worker env)
  const rawJson = (
    (await getBindingOrEnv("GOOGLE_SERVICE_ACCOUNT_JSON")) ||
    (await getBindingOrEnv("GOOGLE_SERVICE_ACCOUNT")) ||
    (await getBindingOrEnv("SERVICE_ACCOUNT_JSON")) ||
    (await getBindingOrEnv("GCP_SA_KEY")) ||
    (await getBindingOrEnv("GCP_CREDENTIALS")) ||
    (await getBindingOrEnv("GOOGLE_CREDENTIALS")) ||
    ""
  ).trim();

  const spreadsheetIdFromEnv = (
    (await getBindingOrEnv("GOOGLE_SPREADSHEET_ID")) ||
    (await getBindingOrEnv("SPREADSHEET_ID")) ||
    (await getBindingOrEnv("GOOGLE_SHEET_ID")) ||
    (await getBindingOrEnv("SHEET_ID")) ||
    ""
  ).trim();

  const cleanEnvSpreadsheetId = spreadsheetIdFromEnv
    ? extractSpreadsheetId(spreadsheetIdFromEnv)
    : undefined;

  if (rawJson) {
    try {
      let parsed: Record<string, unknown>;
      if (rawJson.startsWith("{")) {
        parsed = JSON.parse(rawJson) as Record<string, unknown>;
      } else {
        const decoded = Buffer.from(rawJson, "base64").toString("utf8");
        parsed = JSON.parse(decoded) as Record<string, unknown>;
      }

      const clientEmail = (parsed["client_email"] || parsed["clientEmail"]) as string | undefined;
      const privateKey = (parsed["private_key"] || parsed["privateKey"]) as string | undefined;
      const projectId = (parsed["project_id"] || parsed["projectId"]) as string | undefined;

      if (clientEmail && privateKey) {
        return {
          clientEmail: clientEmail.trim(),
          privateKey: normalizePrivateKey(privateKey),
          projectId: projectId?.trim(),
          spreadsheetId: cleanEnvSpreadsheetId,
        };
      }
    } catch (err) {
      console.warn("[GoogleSheets] Failed to parse Service Account JSON:", err);
    }
  }

  // 2b. Check GOOGLE_APPLICATION_CREDENTIALS path if set
  const appCredsPath = (await getBindingOrEnv("GOOGLE_APPLICATION_CREDENTIALS")).trim();
  if (appCredsPath) {
    try {
      if (
        typeof fs !== "undefined" &&
        typeof fs.existsSync === "function" &&
        fs.existsSync(appCredsPath)
      ) {
        const content = fs.readFileSync(appCredsPath, "utf8");
        const parsed = JSON.parse(content) as Record<string, unknown>;
        const clientEmail = (parsed["client_email"] || parsed["clientEmail"]) as string | undefined;
        const privateKey = (parsed["private_key"] || parsed["privateKey"]) as string | undefined;
        const projectId = (parsed["project_id"] || parsed["projectId"]) as string | undefined;
        if (clientEmail && privateKey) {
          return {
            clientEmail: clientEmail.trim(),
            privateKey: normalizePrivateKey(privateKey),
            projectId: projectId?.trim(),
            spreadsheetId: cleanEnvSpreadsheetId,
          };
        }
      }
    } catch (err) {
      console.warn("[GoogleSheets] Failed to read GOOGLE_APPLICATION_CREDENTIALS file:", err);
    }
  }

  // 3. Check discrete env vars (from process.env or Cloudflare Worker env)
  const email = (
    (await getBindingOrEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL")) ||
    (await getBindingOrEnv("SERVICE_ACCOUNT_EMAIL")) ||
    (await getBindingOrEnv("GCP_SERVICE_ACCOUNT")) ||
    ""
  ).trim();

  const key = (
    (await getBindingOrEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY")) ||
    (await getBindingOrEnv("SERVICE_ACCOUNT_PRIVATE_KEY")) ||
    (await getBindingOrEnv("GOOGLE_PRIVATE_KEY")) ||
    ""
  ).trim();

  if (email && key) {
    return {
      clientEmail: email,
      privateKey: normalizePrivateKey(key),
      spreadsheetId: cleanEnvSpreadsheetId,
    };
  }

  return null;
}

/**
 * Mint Google OAuth2 Bearer Access Token via RS256 JWT assertion
 */
export async function mintServiceAccountAccessToken(
  credentials: ServiceAccountCredentials,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // Return cached token if valid for at least 5 more minutes
  if (cachedServiceAccountToken && cachedServiceAccountToken.expiresAt > now + 300) {
    return cachedServiceAccountToken.token;
  }

  const scopes = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
  ];

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: credentials.clientEmail,
    scope: scopes.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const toSign = `${headerB64}.${payloadB64}`;

  // Ensure clean private key
  const formattedKey = normalizePrivateKey(credentials.privateKey);

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(toSign);
  signer.end();
  const signature = signer.sign(formattedKey);
  const jwt = `${toSign}.${base64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `Google OAuth2 Token Error (${res.status}): ${errorText}. โปรดตรวจความถูกต้องของ Private Key และ Client Email`,
    );
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedServiceAccountToken = {
    token: data.access_token,
    expiresAt: now + (data.expires_in || 3600),
  };

  return data.access_token;
}

/**
 * Get Google Sheets Configuration Status (callable from both ServerFn and raw HTTP routes)
 */
export async function getGoogleSheetsConfigStatus(): Promise<GoogleSheetsConfigStatus> {
  const creds = await resolveServiceAccount();
  const envSpreadsheetId =
    (await getBindingOrEnv("GOOGLE_SPREADSHEET_ID")) ||
    (await getBindingOrEnv("SPREADSHEET_ID")) ||
    (await getBindingOrEnv("GOOGLE_SHEET_ID")) ||
    (await getBindingOrEnv("SHEET_ID")) ||
    "";

  const rawEnvJson =
    (await getBindingOrEnv("GOOGLE_SERVICE_ACCOUNT_JSON")) ||
    (await getBindingOrEnv("GOOGLE_SERVICE_ACCOUNT")) ||
    (await getBindingOrEnv("SERVICE_ACCOUNT_JSON")) ||
    (await getBindingOrEnv("GCP_SA_KEY")) ||
    (await getBindingOrEnv("GCP_CREDENTIALS")) ||
    (await getBindingOrEnv("GOOGLE_CREDENTIALS")) ||
    (await getBindingOrEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"));
  const isFromEnv = Boolean(rawEnvJson);
  const isFromFile =
    !isFromEnv &&
    typeof fs !== "undefined" &&
    typeof fs.existsSync === "function" &&
    fs.existsSync(PERSISTENT_CONFIG_PATH);

  return {
    isConfigured: Boolean(creds?.clientEmail && creds?.privateKey),
    clientEmail: creds?.clientEmail ?? null,
    spreadsheetId:
      creds?.spreadsheetId || (envSpreadsheetId ? extractSpreadsheetId(envSpreadsheetId) : null),
    source: creds
      ? isFromEnv
        ? ("env" as const)
        : isFromFile
          ? ("file" as const)
          : ("runtime" as const)
      : ("none" as const),
    projectId: creds?.projectId ?? null,
  };
}

/**
 * Server Function: Get Google Sheets Configuration Status
 */
export const getGoogleSheetsConfigFn = createServerFn({ method: "GET" }).handler(async () => {
  return await getGoogleSheetsConfigStatus();
});

/**
 * Server Function: Save / Update Service Account Configuration at runtime
 */
export const saveGoogleSheetsConfigFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      jsonKey?: string | undefined;
      clientEmail?: string | undefined;
      privateKey?: string | undefined;
      spreadsheetId?: string | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    let email = data.clientEmail?.trim() || "";
    let key = data.privateKey?.trim() || "";
    let projId: string | undefined;

    if (data.jsonKey && data.jsonKey.trim()) {
      try {
        const parsed = JSON.parse(data.jsonKey.trim()) as Record<string, unknown>;
        email = (parsed["client_email"] || parsed["clientEmail"] || "") as string;
        key = (parsed["private_key"] || parsed["privateKey"] || "") as string;
        projId = (parsed["project_id"] || parsed["projectId"]) as string | undefined;
      } catch {
        return {
          success: false,
          error: "รูปแบบ JSON Key ไม่ถูกต้อง กรุณาคัดลอกทั้งก้อน JSON จาก Google Cloud Console",
        };
      }
    }

    if (!email || !key) {
      return {
        success: false,
        error: "ต้องระบุ Client Email และ Private Key ให้ครบถ้วน",
      };
    }

    const cleanSpreadsheetId = data.spreadsheetId
      ? extractSpreadsheetId(data.spreadsheetId)
      : undefined;

    // Test token minting before saving to ensure key is valid
    try {
      await mintServiceAccountAccessToken({
        clientEmail: email,
        privateKey: key,
      });
    } catch (testErr) {
      return {
        success: false,
        error: `ตรวจสอบ Service Account ไม่ผ่าน: ${testErr instanceof Error ? testErr.message : String(testErr)}`,
      };
    }

    runtimeServiceAccount = {
      clientEmail: email,
      privateKey: key,
      projectId: projId,
      spreadsheetId: cleanSpreadsheetId,
    };
    writePersistedConfig(runtimeServiceAccount);

    return {
      success: true,
      clientEmail: email,
      spreadsheetId: cleanSpreadsheetId || null,
      message: "บันทึกและเชื่อมต่อ Google Service Account สำเร็จแล้ว พร้อมใช้งานตลอดเวลา",
    };
  });

/**
 * Server Function: Disconnect / Remove Service Account Configuration
 */
export const disconnectGoogleSheetsConfigFn = createServerFn({ method: "POST" }).handler(
  async () => {
    runtimeServiceAccount = null;
    cachedServiceAccountToken = null;
    writePersistedConfig(null);
    return {
      success: true,
      message: "ตัดการเชื่อมต่อ Google Service Account เรียบร้อยแล้ว",
    };
  },
);

/**
 * Server Function: Get Valid Access Token for Google Sheets API
 */
export const getGoogleSheetsAccessTokenFn = createServerFn({ method: "GET" }).handler(async () => {
  const creds = await resolveServiceAccount();
  if (!creds) {
    return {
      success: false as const,
      error: "ยังไม่ได้กำหนดค่า Google Service Account ในระบบ",
      token: null,
    };
  }

  try {
    const token = await mintServiceAccountAccessToken(creds);
    return {
      success: true as const,
      token,
      clientEmail: creds.clientEmail,
      defaultSpreadsheetId: creds.spreadsheetId || null,
    };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : String(err),
      token: null,
    };
  }
});

/**
 * Server Function: Test Connection to Google Spreadsheet via Service Account
 */
export const testGoogleSheetsConnectionFn = createServerFn({ method: "POST" })
  .validator((data: { spreadsheetId?: string | undefined }) => data)
  .handler(async ({ data }) => {
    const creds = await resolveServiceAccount();
    if (!creds) {
      return {
        success: false,
        error:
          "ยังไม่ได้กำหนดค่า Google Service Account ในระบบ กรุณาใส่ Service Account JSON หรือ Email/Key",
      };
    }

    const targetId = data.spreadsheetId
      ? extractSpreadsheetId(data.spreadsheetId)
      : creds.spreadsheetId;

    try {
      const token = await mintServiceAccountAccessToken(creds);

      if (!targetId) {
        // Test token validity against Google Drive API
        const testRes = await fetch("https://www.googleapis.com/drive/v3/files?pageSize=1", {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        if (!testRes.ok) {
          const errText = await testRes.text();
          return {
            success: false,
            error: `Google API Error (${testRes.status}): ${errText}`,
          };
        }

        return {
          success: true,
          spreadsheetId: null,
          title: "Google Service Account",
          tabs: [],
          clientEmail: creds.clientEmail,
          message: `Service Account (${creds.clientEmail}) ยืนยันสิทธิ์กับ Google สำเร็จแล้ว พร้อมใช้งาน! สามารถระบุลิงก์ Google Sheet เพื่อทดสอบการเข้าถึงไฟล์เฉพาะ`,
        };
      }

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(targetId)}?fields=properties.title,spreadsheetUrl,sheets.properties.title,sheets.properties.sheetId`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        if (res.status === 404) {
          return {
            success: false,
            error: "ไม่พบ Google Sheet นี้ โปรดตรวจสอบ Spreadsheet ID หรือลิงก์ให้ถูกต้อง",
          };
        }
        if (res.status === 403) {
          return {
            success: false,
            error: `ไม่มีสิทธิ์เข้าถึง Google Sheet: กรุณาเปิดแชร์ไฟล์ Google Sheet นี้ให้กับ ${creds.clientEmail} โดยให้สิทธิ์ "Editor" (ผู้แก้ไข)`,
          };
        }
        const errText = await res.text();
        return {
          success: false,
          error: `Google API Error (${res.status}): ${errText}`,
        };
      }

      const sheetData = (await res.json()) as {
        properties?: { title?: string };
        spreadsheetUrl?: string;
        sheets?: Array<{ properties?: { title?: string; sheetId?: number } }>;
      };

      const title = sheetData.properties?.title || "Google Spreadsheet";
      const tabs = (sheetData.sheets || []).map((s) => s.properties?.title || "Sheet1");

      return {
        success: true,
        spreadsheetId: targetId,
        title,
        tabs,
        spreadsheetUrl:
          sheetData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${targetId}`,
        clientEmail: creds.clientEmail,
        message: `เชื่อมต่อกับ "${title}" สำเร็จ! พบแผ่นงาน ${tabs.length} แท็บ พร้อมอ่าน-บันทึกข้อมูล`,
      };
    } catch (err) {
      return {
        success: false,
        error: `ทดสอบการเชื่อมต่อไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  });

export interface ServerBackupResult {
  success: boolean;
  message: string;
  spreadsheetId?: string;
  spreadsheetTitle?: string;
  spreadsheetUrl?: string;
  backedUpAt?: string;
  stats?: {
    products: number;
    movements: number;
    orders: number;
    categories: number;
    subCategories: number;
    zones: number;
    units: number;
  };
  error?: string;
}

let lastServerBackupStatus: ServerBackupResult | null = null;

export function getLastServerBackupStatus(): ServerBackupResult | null {
  return lastServerBackupStatus;
}

/**
 * Execute Full Server-Side Backup of PostgreSQL / D1 database directly to Google Sheets via Service Account
 */
export async function backupDatabaseToGoogleSheetsServer(options?: {
  spreadsheetId?: string;
}): Promise<ServerBackupResult> {
  const creds = await resolveServiceAccount();
  if (!creds || !creds.clientEmail || !creds.privateKey) {
    return {
      success: false,
      message:
        "ไม่พบข้อมูล Google Service Account (กรุณากำหนด GOOGLE_SERVICE_ACCOUNT_JSON หรือ EMAIL/KEY ใน GitHub Secrets หรือหน้าการตั้งค่า)",
      error: "Service Account not configured",
    };
  }

  const targetId = options?.spreadsheetId
    ? extractSpreadsheetId(options.spreadsheetId)
    : creds.spreadsheetId
      ? extractSpreadsheetId(creds.spreadsheetId)
      : undefined;

  if (!targetId) {
    return {
      success: false,
      message:
        "ยังไม่ได้ระบุ Google Spreadsheet ID (กรุณากำหนด GOOGLE_SPREADSHEET_ID ใน GitHub Secrets หรือระบุลิงก์ Google Sheet ในหน้าตั้งค่า)",
      error: "Missing GOOGLE_SPREADSHEET_ID",
    };
  }

  // 1. Fetch current database snapshot
  let snapshot: {
    units: Array<{ id: string; name: string; shortName?: string; short_name?: string }>;
    categories: Array<{ id: string; code?: string; name: string }>;
    subCategories: Array<{
      id: string;
      categoryId?: string;
      category_id?: string;
      code?: string;
      name: string;
    }>;
    zones: Array<{ id: string; code?: string; name: string; description?: string | null }>;
    products: Array<{
      id: string;
      sku?: string;
      barcode?: string;
      codeType?: string;
      format?: string;
      name: string;
      imageUrl?: string | null;
      categoryId: string;
      subCategoryId?: string | null;
      zoneId?: string | null;
      unitId: string;
      costPrice?: number | null;
      sellPrice?: number | null;
      stock?: number | null;
      minStock?: number | null;
      targetStock?: number | null;
      reorderQuantity?: number | null;
      isActive?: boolean | number | null;
      createdAt?: string | null;
      updatedAt?: string | null;
    }>;
    purchaseOrders: Array<Record<string, unknown>>;
    movements: Array<Record<string, unknown>>;
    receives?: Array<Record<string, unknown>>;
    followers?: Array<Record<string, unknown>>;
  } | null = null;

  try {
    const pgData = await getDatabaseSnapshot();
    snapshot = pgData as unknown as typeof snapshot;
  } catch (pgErr) {
    console.warn("[Server Backup] getDatabaseSnapshot failed, attempting D1 fallback:", pgErr);
    try {
      const d1Data = await getD1Snapshot();
      if (d1Data) {
        snapshot = {
          units: d1Data.units,
          categories: d1Data.categories,
          subCategories: d1Data.subCategories,
          zones: d1Data.zones,
          products: d1Data.products,
          purchaseOrders: d1Data.purchaseOrders as Array<Record<string, unknown>>,
          movements: d1Data.movements as Array<Record<string, unknown>>,
          receives: d1Data.receives as Array<Record<string, unknown>>,
          followers: d1Data.followers as Array<Record<string, unknown>>,
        };
      }
    } catch (d1Err) {
      console.warn("[Server Backup] D1 fallback failed:", d1Err);
    }
  }

  if (!snapshot) {
    return {
      success: false,
      message: "ไม่สามารถดึงข้อมูลจากฐานข้อมูลของระบบได้",
      error: "Database snapshot unavailable",
    };
  }

  const products = snapshot.products || [];
  const movements = snapshot.movements || [];
  const orders = snapshot.purchaseOrders || [];
  const categories = snapshot.categories || [];
  const subCategories = snapshot.subCategories || [];
  const zones = snapshot.zones || [];
  const units = snapshot.units || [];

  // Helper maps for names
  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const subCatMap = new Map(subCategories.map((sc) => [sc.id, sc.name]));
  const zoneMap = new Map(zones.map((z) => [z.id, z.name]));
  const unitMap = new Map(units.map((u) => [u.id, u.name || u.shortName || "ชิ้น"]));

  const now = new Date();
  const thaiTimestamp = now.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });

  // Tab 1: Overview
  const totalStockUnits = products.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);
  const totalCostValue = products.reduce(
    (acc, p) => acc + (Number(p.stock) || 0) * (Number(p.costPrice) || 0),
    0,
  );
  const totalSellValue = products.reduce(
    (acc, p) => acc + (Number(p.stock) || 0) * (Number(p.sellPrice) || 0),
    0,
  );

  const overviewRows: (string | number)[][] = [
    ["📊 ฐานข้อมูลสำรองร้านค้า MiniMark (Server-Side Auto Backup)"],
    ["อัปเดตข้อมูลล่าสุดเมื่อ (Thai Time)", thaiTimestamp, "ISO Timestamp", now.toISOString()],
    ["ระบบผู้ให้บริการ", "MiniMark 1990s Mom-and-Pop Shop", "Service Account", creds.clientEmail],
    [""],
    ["📈 สรุปตัวเลขสถิติฐานข้อมูล (Database Summary Statistics)"],
    ["รายการสถิติ", "จำนวน / มูลค่า", "หน่วยนับ"],
    ["จำนวนสินค้าทั้งหมด (Total Products)", products.length, "รายการ"],
    ["ยอดสต็อกสินค้ารวม (Total Stock Units)", totalStockUnits, "ชิ้น"],
    ["มูลค่าสต็อกต้นทุนรวม (Total Cost Value)", Math.round(totalCostValue * 100) / 100, "บาท"],
    ["มูลค่าสต็อกราคาขายรวม (Total Retail Value)", Math.round(totalSellValue * 100) / 100, "บาท"],
    ["ประวัติการสั่งซื้อ (Total Purchase Orders)", orders.length, "ใบสั่งซื้อ"],
    ["ประวัติการเคลื่อนไหวสต็อก (Stock Movements)", movements.length, "รายการ"],
    ["หมวดหมู่สินค้าหลัก (Categories)", categories.length, "หมวดหมู่"],
    ["หมวดหมู่สินค้าย่อย (Subcategories)", subCategories.length, "หมวดย่อย"],
    ["โซนจัดเก็บสินค้า (Storage Zones)", zones.length, "โซน"],
    ["หน่วยนับสินค้า (Units)", units.length, "หน่วย"],
    [""],
    ["ℹ️ คำแนะนำแท็บข้อมูลในสเปรดชีตนี้"],
    ["แท็บ 1: สรุปภาพรวม - สรุปตัวเลขสถิติร้านค้าและประวัติเวลาการสำรองข้อมูล"],
    ["แท็บ 2: สินค้า - รายการสินค้า บาร์โค้ด ราคาต้นทุน ราคาขาย และยอดสต็อกปัจจุบัน"],
    ["แท็บ 3: การเคลื่อนไหวสต็อก - บันทึกประวัติการรับเข้า เบิกออก และปรับยอดตรวจนับ"],
    ["แท็บ 4: ใบสั่งซื้อ - รายการใบสั่งซื้อสินค้า PO ซัพพลายเออร์ และสถานะ"],
    ["แท็บ 5: ข้อมูลหลัก - หมวดหมู่ หมวดหมู่ย่อย โซนจัดเก็บ และหน่วยนับ"],
    ["แท็บ 6: สำรองดิบ_JSON - ข้อมูลสำรองรูปแบบ JSON สำหรับกู้คืนข้อมูล 100%"],
  ];

  // Tab 2: Products
  const productHeaders = [
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

  const productDataRows = products.map((p) => {
    const cost = Number(p.costPrice) || 0;
    const sell = Number(p.sellPrice) || 0;
    const stock = Number(p.stock) || 0;
    const profit = Math.round((sell - cost) * 100) / 100;
    const totalVal = Math.round(stock * cost * 100) / 100;
    const isActive = p.isActive !== false && p.isActive !== 0;
    return [
      p.barcode || "",
      p.sku || "",
      p.name || "",
      catMap.get(p.categoryId) || p.categoryId || "-",
      (p.subCategoryId && subCatMap.get(p.subCategoryId)) || p.subCategoryId || "-",
      (p.zoneId && zoneMap.get(p.zoneId)) || p.zoneId || "-",
      unitMap.get(p.unitId) || p.unitId || "ชิ้น",
      cost,
      sell,
      profit,
      stock,
      totalVal,
      Number(p.minStock) || 5,
      Number(p.targetStock) || 15,
      Number(p.reorderQuantity) || 15,
      isActive ? "เปิดขายปกติ" : "ระงับชั่วคราว",
      p.updatedAt || p.createdAt || now.toISOString(),
    ];
  });
  const productRows = [productHeaders, ...productDataRows];

  // Tab 3: Movements
  const movementHeaders = [
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
  const movementDataRows = movements.map((m) => [
    String(m["timestamp"] || ""),
    String(m["id"] || ""),
    typeMap[String(m["type"])] || String(m["type"] || ""),
    String(m["productName"] || m["product_name"] || ""),
    String(m["barcode"] || ""),
    Number(m["quantity"] || 0),
    Number(m["previousStock"] || m["previous_stock"] || 0),
    Number(m["newStock"] || m["new_stock"] || 0),
    String(m["operator"] || "ระบบ"),
    String(m["note"] || "-"),
  ]);
  const movementRows = [movementHeaders, ...movementDataRows];

  // Tab 4: Purchase Orders
  const orderHeaders = [
    "เลขที่ใบสั่งซื้อ (PO Number)",
    "วันที่สั่งซื้อ (Created At)",
    "ซัพพลายเออร์ (Supplier)",
    "สถานะ (Status)",
    "จำนวนรายการ (Line Items)",
    "ยอดชิ้นรวม (Total Qty)",
    "ยอดเงินรวมบาท (Total Cost)",
    "ส่งทาง LINE เมื่อ (LINE Sent At)",
    "รายการสินค้าโดยสรุป (Items Summary)",
  ];
  const poStatusMap: Record<string, string> = {
    DRAFT: "ฉบับร่าง",
    ORDERED: "สั่งซื้อแล้ว",
    RECEIVED: "รับสินค้าแล้ว",
    CANCELLED: "ยกเลิก",
  };
  const orderDataRows = orders.map((o) => {
    let itemsArr: Array<{ productName?: string; quantity?: number; unitName?: string }> = [];
    if (Array.isArray(o["items"])) {
      itemsArr = o["items"] as typeof itemsArr;
    } else if (typeof o["itemsJson"] === "string") {
      try {
        itemsArr = JSON.parse(o["itemsJson"]) as typeof itemsArr;
      } catch {
        itemsArr = [];
      }
    }
    const summary = itemsArr
      .map((it) => `${it.productName || "สินค้า"} (${it.quantity || 0} ${it.unitName || "ชิ้น"})`)
      .join(", ");
    const status = String(o["status"] || "DRAFT");
    return [
      String(o["orderNumber"] || o["order_number"] || ""),
      String(o["createdAt"] || o["created_at"] || ""),
      String(o["supplierName"] || o["supplier_name"] || "-"),
      poStatusMap[status] || status,
      itemsArr.length,
      Number(o["totalQuantity"] || o["total_quantity"] || 0),
      Number(o["totalCost"] || o["total_cost"] || 0),
      String(o["sentViaLineAt"] || o["sent_via_line_at"] || "-"),
      summary || "-",
    ];
  });
  const orderRows = [orderHeaders, ...orderDataRows];

  // Tab 5: Master Data
  const masterRows: (string | number)[][] = [
    ["🏷️ ข้อมูลหลักของระบบ (Master Data Categories, Subcategories, Zones, Units)"],
    [""],
    ["=== 1. หมวดหมู่สินค้าหลัก (Categories) ==="],
    ["รหัสหมวดหมู่ (ID)", "รหัสย่อ (Code)", "ชื่อหมวดหมู่ (Category Name)"],
    ...categories.map((c) => [c.id, c.code || "-", c.name]),
    [""],
    ["=== 2. หมวดหมู่สินค้าย่อย (Subcategories) ==="],
    ["รหัสหมวดย่อย (ID)", "รหัสหมวดหลัก (Cat ID)", "รหัสย่อ (Code)", "ชื่อหมวดย่อย (Name)"],
    ...subCategories.map((sc) => [
      sc.id,
      sc.categoryId || sc.category_id || "-",
      sc.code || "-",
      sc.name,
    ]),
    [""],
    ["=== 3. โซนจัดเก็บสินค้า (Storage Zones) ==="],
    ["รหัสโซน (ID)", "รหัสย่อ (Code)", "ชื่อโซน (Zone Name)", "คำอธิบาย (Description)"],
    ...zones.map((z) => [z.id, z.code || "-", z.name, z.description || "-"]),
    [""],
    ["=== 4. หน่วยนับสินค้า (Units) ==="],
    ["รหัสหน่วย (ID)", "ชื่อหน่วยนับ (Unit Name)", "ชื่อย่อ (Short Name)"],
    ...units.map((u) => [u.id, u.name, u.shortName || u.short_name || u.name]),
  ];

  // Tab 6: Raw JSON payload
  const rawPayload = {
    metadata: {
      version: "2.0.0",
      createdAt: now.toISOString(),
      createdAtThai: thaiTimestamp,
      exportedBy: `Service Account (${creds.clientEmail})`,
      storeName: "โชห่วยยุค90s",
      totalProducts: products.length,
      totalOrders: orders.length,
      totalMovements: movements.length,
      totalCategories: categories.length,
    },
    data: snapshot,
  };
  const rawJsonRows: (string | number)[][] = [
    ["⚙️ ข้อมูลสำรองเชิงลึก (Raw JSON Payload) - ห้ามแก้ไขข้อมูลในแถวที่ 2 โดยตรง"],
    [JSON.stringify(rawPayload)],
  ];

  const sheetsData = [
    { title: "📊 สรุปภาพรวม", rows: overviewRows },
    { title: "📦 สินค้า", rows: productRows },
    { title: "📝 การเคลื่อนไหวสต็อก", rows: movementRows },
    { title: "📋 ใบสั่งซื้อ", rows: orderRows },
    { title: "🏷️ ข้อมูลหลัก", rows: masterRows },
    { title: "⚙️ สำรองดิบ_JSON", rows: rawJsonRows },
  ];

  try {
    const token = await mintServiceAccountAccessToken(creds);

    // 2. Read spreadsheet metadata to verify existence and permissions
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(targetId)}?fields=properties.title,spreadsheetUrl,sheets.properties.title`;
    const metaRes = await fetch(metaUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!metaRes.ok) {
      if (metaRes.status === 404) {
        return {
          success: false,
          message: `ไม่พบ Google Sheet ตาม ID "${targetId}" โปรดตรวจสอบ Spreadsheet ID ให้ถูกต้อง`,
          error: "Spreadsheet not found (404)",
        };
      }
      if (metaRes.status === 403) {
        return {
          success: false,
          message: `Service Account ไม่มีสิทธิ์แก้ไข Google Sheet: กรุณาเปิดไฟล์ Google Sheet แล้วกดปุ่ม "แชร์" (Share) เพิ่มอีเมล ${creds.clientEmail} โดยให้สิทธิ์ "Editor" (ผู้แก้ไข)`,
          error: `Permission denied (403): Share spreadsheet with ${creds.clientEmail} as Editor`,
        };
      }
      const errBody = await metaRes.text();
      return {
        success: false,
        message: `Google Sheets API Error (${metaRes.status}): ${errBody}`,
        error: errBody,
      };
    }

    const metaData = (await metaRes.json()) as {
      properties?: { title?: string };
      spreadsheetUrl?: string;
      sheets?: Array<{ properties?: { title?: string } }>;
    };

    const sheetTitle = metaData.properties?.title || "Google Spreadsheet";
    const sheetUrl =
      metaData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${targetId}`;
    const existingTitles = new Set((metaData.sheets || []).map((s) => s.properties?.title || ""));

    // 3. Add any missing tabs
    const missingTabs = sheetsData
      .map((s) => s.title)
      .filter((title) => !existingTitles.has(title));

    if (missingTabs.length > 0) {
      const addRequests = missingTabs.map((t) => ({
        addSheet: { properties: { title: t } },
      }));
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(targetId)}:batchUpdate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ requests: addRequests }),
        },
      ).catch((err) => console.warn("[Server Backup] addSheet batchUpdate note:", err));
    }

    // 4. Batch update all data ranges
    const batchData = sheetsData.map((s) => ({
      range: `'${s.title}'!A1`,
      values: s.rows,
    }));

    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(targetId)}/values:batchUpdate`;
    const updateRes = await fetch(updateUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        valueInputOption: "USER_ENTERED",
        data: batchData,
      }),
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      return {
        success: false,
        message: `บันทึกข้อมูลลง Google Sheets ไม่สำเร็จ: ${errText}`,
        error: errText,
      };
    }

    const result: ServerBackupResult = {
      success: true,
      message: `สำรองข้อมูลลง Google Sheet "${sheetTitle}" สำเร็จครบทั้ง 6 แผ่นงาน (${products.length} สินค้า, ${movements.length} ประวัติสต็อก, ${orders.length} ใบสั่งซื้อ)`,
      spreadsheetId: targetId,
      spreadsheetTitle: sheetTitle,
      spreadsheetUrl: sheetUrl,
      backedUpAt: now.toISOString(),
      stats: {
        products: products.length,
        movements: movements.length,
        orders: orders.length,
        categories: categories.length,
        subCategories: subCategories.length,
        zones: zones.length,
        units: units.length,
      },
    };

    lastServerBackupStatus = result;
    return result;
  } catch (apiErr) {
    const errorMsg = apiErr instanceof Error ? apiErr.message : String(apiErr);
    return {
      success: false,
      message: `เกิดข้อผิดพลาดในการสำรองข้อมูล: ${errorMsg}`,
      error: errorMsg,
    };
  }
}

/**
 * Server Function: Trigger Server-Side Backup from Client UI
 */
export const triggerServerBackupToGoogleSheetsFn = createServerFn({ method: "POST" })
  .validator((data: { spreadsheetId?: string | undefined }) => data)
  .handler(async ({ data }) => {
    return await backupDatabaseToGoogleSheetsServer({
      spreadsheetId: data?.spreadsheetId,
    });
  });

/**
 * Debounced Auto-Backup Trigger on the Server
 */
let serverAutoBackupTimer: NodeJS.Timeout | null = null;
let isServerBackingUp = false;

export function scheduleAutoBackupToServerSheets(): void {
  if (serverAutoBackupTimer) clearTimeout(serverAutoBackupTimer);
  serverAutoBackupTimer = setTimeout(async () => {
    if (isServerBackingUp) return;
    const creds = await resolveServiceAccount();
    if (!creds?.clientEmail || !creds?.spreadsheetId) return;

    isServerBackingUp = true;
    try {
      console.log("[Auto-Backup] Running scheduled server backup to Google Sheets...");
      const res = await backupDatabaseToGoogleSheetsServer();
      if (res.success) {
        console.log("[Auto-Backup] Server backup successful:", res.message);
      } else {
        console.warn("[Auto-Backup] Server backup noticed issue:", res.message);
      }
    } catch (err) {
      console.warn("[Auto-Backup] Server backup error:", err);
    } finally {
      isServerBackingUp = false;
    }
  }, 12_000); // Debounce 12 seconds
}
