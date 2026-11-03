import { createServerFn } from "@tanstack/react-start";
import { getD1Snapshot } from "../db/d1-snapshot.ts";
import { getDatabaseSnapshot } from "../db/db-service.ts";
import { isPostgresConfigured } from "../db/index.ts";

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
  source: "env" | "d1" | "runtime" | "none";
  projectId?: string | null;
}

let runtimeServiceAccount: ServiceAccountCredentials | null = null;
let cachedServiceAccountToken: { token: string; expiresAt: number } | null = null;

const SA_SETTINGS_KEY = "google_service_account";

function envGet(key: string): string {
  try {
    const g = globalThis as unknown as { process?: { env?: Record<string, string | undefined> } };
    const val = g.process?.env?.[key];
    return typeof val === "string" ? val.trim() : "";
  } catch {
    return "";
  }
}

async function getBindingOrEnv(key: string): Promise<string> {
  const fromEnv = envGet(key);
  if (fromEnv) return fromEnv;
  try {
    const g = globalThis as unknown as Record<string, unknown>;
    const workerEnv = (g["__worker_env__"] || g["__env__"]) as Record<string, unknown> | undefined;
    if (workerEnv && typeof workerEnv[key] === "string" && (workerEnv[key] as string).trim()) {
      return (workerEnv[key] as string).trim();
    }
  } catch {}
  try {
    const modName = "cloudflare" + ":workers";
    const mod = (await import(/* @vite-ignore */ modName)) as { env?: Record<string, unknown> };
    const val = mod?.env?.[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  } catch {}
  return "";
}

type D1Prepared = {
  bind: (...values: unknown[]) => {
    run: () => Promise<unknown>;
    all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
    first: <T = Record<string, unknown>>() => Promise<T | null>;
  };
  run: () => Promise<unknown>;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
};

type D1Like = {
  prepare: (sql: string) => D1Prepared;
  exec?: (sql: string) => Promise<unknown>;
};

async function getD1Binding(): Promise<D1Like | null> {
  try {
    const cfName = "cloudflare" + ":workers";
    const mod = (await import(/* @vite-ignore */ cfName)) as { env?: { DB?: D1Like } };
    if (mod?.env?.DB) return mod.env.DB;
  } catch {}
  try {
    const g = globalThis as unknown as {
      DB?: D1Like;
      __worker_env__?: { DB?: D1Like };
      __env__?: { DB?: D1Like };
    };
    if (g.DB) return g.DB;
    if (g.__worker_env__?.DB) return g.__worker_env__.DB;
    if (g.__env__?.DB) return g.__env__.DB;
  } catch {}
  return null;
}

async function ensureAppSettingsTable(db: D1Like): Promise<void> {
  try {
    if (typeof db.exec === "function") {
      await db.exec(
        `CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT
        )`,
      );
    } else {
      await db
        .prepare(
          `CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT
          )`,
        )
        .run();
    }
  } catch (err) {
    console.warn("[GoogleSheets] ensure app_settings table:", err);
  }
}

export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] || trimmed;
}

function normalizePrivateKey(rawKey: string): string {
  let key = rawKey.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim();
}

async function readSaFromD1(): Promise<ServiceAccountCredentials | null> {
  try {
    const db = await getD1Binding();
    if (!db) return null;
    await ensureAppSettingsTable(db);
    const row = await db
      .prepare("SELECT value FROM app_settings WHERE key = ?")
      .bind(SA_SETTINGS_KEY)
      .first<{ value: string }>();
    if (!row?.value) return null;
    const parsed = JSON.parse(row.value) as Partial<ServiceAccountCredentials>;
    if (parsed.clientEmail && parsed.privateKey) {
      return {
        clientEmail: String(parsed.clientEmail).trim(),
        privateKey: normalizePrivateKey(String(parsed.privateKey)),
        projectId: parsed.projectId ? String(parsed.projectId).trim() : undefined,
        spreadsheetId: parsed.spreadsheetId
          ? extractSpreadsheetId(String(parsed.spreadsheetId))
          : undefined,
      };
    }
  } catch (err) {
    console.warn("[GoogleSheets] Failed to read SA from D1:", err);
  }
  return null;
}

async function writeSaToD1(creds: ServiceAccountCredentials | null): Promise<boolean> {
  try {
    const db = await getD1Binding();
    if (!db) return false;
    await ensureAppSettingsTable(db);
    if (!creds) {
      await db.prepare("DELETE FROM app_settings WHERE key = ?").bind(SA_SETTINGS_KEY).run();
      return true;
    }
    const payload = JSON.stringify({
      clientEmail: creds.clientEmail,
      privateKey: creds.privateKey,
      projectId: creds.projectId ?? null,
      spreadsheetId: creds.spreadsheetId ?? null,
    });
    const now = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .bind(SA_SETTINGS_KEY, payload, now)
      .run();
    return true;
  } catch (err) {
    console.warn("[GoogleSheets] Failed to write SA to D1:", err);
    return false;
  }
}

function base64url(input: string | Uint8Array): string {
  let b64: string;
  if (typeof input === "string") {
    b64 = btoa(unescape(encodeURIComponent(input)));
  } else {
    let s = "";
    for (let i = 0; i < input.length; i++) s += String.fromCharCode(input[i]!);
    b64 = btoa(s);
  }
  return b64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function resolveServiceAccount(): Promise<ServiceAccountCredentials | null> {
  if (runtimeServiceAccount?.clientEmail && runtimeServiceAccount?.privateKey) {
    return runtimeServiceAccount;
  }

  const fromD1 = await readSaFromD1();
  if (fromD1?.clientEmail && fromD1?.privateKey) {
    runtimeServiceAccount = fromD1;
    return fromD1;
  }

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
        const decoded = typeof atob === "function" ? atob(rawJson) : rawJson;
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

export async function mintServiceAccountAccessToken(
  credentials: ServiceAccountCredentials,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedServiceAccountToken && cachedServiceAccountToken.expiresAt > now + 300) {
    return cachedServiceAccountToken.token;
  }
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: credentials.clientEmail,
    scope:
      "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const toSign = `${headerB64}.${payloadB64}`;

  const pem = normalizePrivateKey(credentials.privateKey);
  const pemBody = pem
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "")
    .replace(/\s/g, "");
  const raw = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    raw,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(toSign));
  const jwt = `${toSign}.${base64url(new Uint8Array(sig))}`;

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
    throw new Error(`Google OAuth2 Token Error (${res.status}): ${errorText}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedServiceAccountToken = {
    token: data.access_token,
    expiresAt: now + (data.expires_in || 3600),
  };
  return data.access_token;
}

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
    (await getBindingOrEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"));

  let source: GoogleSheetsConfigStatus["source"] = "none";
  if (creds) {
    if (rawEnvJson) {
      source = "env";
    } else {
      const d1Hit = await readSaFromD1();
      source = d1Hit?.clientEmail === creds.clientEmail ? "d1" : "runtime";
    }
  }

  return {
    isConfigured: Boolean(creds?.clientEmail && creds?.privateKey),
    clientEmail: creds?.clientEmail ?? null,
    spreadsheetId:
      creds?.spreadsheetId || (envSpreadsheetId ? extractSpreadsheetId(envSpreadsheetId) : null),
    source,
    projectId: creds?.projectId ?? null,
  };
}

export const getGoogleSheetsConfigFn = createServerFn({ method: "GET" }).handler(async () => {
  return await getGoogleSheetsConfigStatus();
});

export const saveGoogleSheetsConfigFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      jsonKey?: string | undefined;
      clientEmail?: string | undefined;
      privateKey?: string | undefined;
      spreadsheetId?: string | undefined;
    }) => data,
  )
  .handler(async ({ data: rawData }) => {
    const data = rawData ?? {};
    let email = data.clientEmail?.trim() || "";
    let key = data.privateKey?.trim() || "";
    let projId: string | undefined;
    if (data.jsonKey?.trim()) {
      try {
        const parsed = JSON.parse(data.jsonKey.trim()) as Record<string, unknown>;
        email = (parsed["client_email"] || parsed["clientEmail"] || "") as string;
        key = (parsed["private_key"] || parsed["privateKey"] || "") as string;
        projId = (parsed["project_id"] || parsed["projectId"]) as string | undefined;
      } catch {
        return { success: false, error: "รูปแบบ JSON Key ไม่ถูกต้อง" };
      }
    }
    if (!email || !key) {
      return { success: false, error: "ต้องระบุ Client Email และ Private Key" };
    }
    const cleanSpreadsheetId = data.spreadsheetId
      ? extractSpreadsheetId(data.spreadsheetId)
      : undefined;
    try {
      await mintServiceAccountAccessToken({ clientEmail: email, privateKey: key });
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
    cachedServiceAccountToken = null;

    const persisted = await writeSaToD1(runtimeServiceAccount);
    return {
      success: true,
      clientEmail: email,
      spreadsheetId: cleanSpreadsheetId || null,
      message: persisted
        ? "บันทึก Service Account สำเร็จ (เก็บถาวรใน D1 แล้ว)"
        : "บันทึก Service Account สำเร็จ (memory เท่านั้น — D1 ไม่พร้อม)",
      persisted,
    };
  });

export const disconnectGoogleSheetsConfigFn = createServerFn({ method: "POST" }).handler(
  async () => {
    runtimeServiceAccount = null;
    cachedServiceAccountToken = null;
    await writeSaToD1(null);
    return { success: true, message: "ตัดการเชื่อมต่อแล้ว" };
  },
);

export const getGoogleSheetsAccessTokenFn = createServerFn({ method: "GET" }).handler(async () => {
  const creds = await resolveServiceAccount();
  if (!creds) {
    return { success: false as const, error: "ยังไม่ได้กำหนด Service Account", token: null };
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

export const testGoogleSheetsConnectionFn = createServerFn({ method: "POST" })
  .validator((data: { spreadsheetId?: string | undefined }) => data)
  .handler(async ({ data: rawData }) => {
    const data = rawData ?? {};
    const creds = await resolveServiceAccount();
    if (!creds) {
      return { success: false, error: "ยังไม่ได้กำหนด Service Account" };
    }
    const targetId = data.spreadsheetId
      ? extractSpreadsheetId(data.spreadsheetId)
      : creds.spreadsheetId;
    try {
      const token = await mintServiceAccountAccessToken(creds);
      if (!targetId) {
        const testRes = await fetch("https://www.googleapis.com/drive/v3/files?pageSize=1", {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });
        if (!testRes.ok) {
          return { success: false, error: `Google API Error (${testRes.status})` };
        }
        return {
          success: true,
          spreadsheetId: null,
          title: "Google Service Account",
          message: "เชื่อมต่อ Service Account สำเร็จ",
        };
      }
      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${targetId}?fields=spreadsheetId,properties.title`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
      );
      if (!metaRes.ok) {
        const errText = await metaRes.text();
        return { success: false, error: `Sheets API (${metaRes.status}): ${errText}` };
      }
      const meta = (await metaRes.json()) as {
        spreadsheetId?: string;
        properties?: { title?: string };
      };
      const title = meta.properties?.title || "Spreadsheet";
      return {
        success: true,
        spreadsheetId: meta.spreadsheetId || targetId,
        title,
        message: `เชื่อมต่อสำเร็จ: ${title}`,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

export type ServerBackupResult = {
  success: boolean;
  message?: string;
  error?: string;
  spreadsheetId?: string;
  spreadsheetTitle?: string;
  spreadsheetUrl?: string;
  backedUpAt?: string;
  stats?: {
    products: number;
    movements: number;
    orders: number;
    categories: number;
  };
};

type ServerBackupTab = {
  title: string;
  rows: (string | number)[][];
};

let lastServerBackupStatus: ServerBackupResult & { checkedAt?: string } = {
  success: false,
  message: "ยังไม่มีประวัติการสำรองข้อมูลจากเซิร์ฟเวอร์",
};
let serverAutoBackupTimer: ReturnType<typeof setTimeout> | null = null;
let serverBackupInProgress = false;

export function getLastServerBackupStatus() {
  return lastServerBackupStatus;
}

function cell(value: unknown): string | number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value) ?? String(value);
}

function buildServerBackupTabs(snapshot: Awaited<ReturnType<typeof getDatabaseSnapshot>>): ServerBackupTab[] {
  const products = snapshot.products ?? [];
  const movements = snapshot.movements ?? [];
  const orders = snapshot.purchaseOrders ?? [];
  const categories = snapshot.categories ?? [];
  const raw = JSON.stringify(snapshot);

  return [
    {
      title: "📊 สรุปภาพรวม",
      rows: [
        ["ฐานข้อมูลสำรองร้านค้า - 90s Mom-and-Pop Shop"],
        ["สำรองเมื่อ", new Date().toISOString()],
        ["จำนวนสินค้า", products.length],
        ["ประวัติสต็อก", movements.length],
        ["ใบสั่งซื้อ", orders.length],
        ["หมวดหมู่", categories.length],
      ],
    },
    {
      title: "📦 สินค้า",
      rows: [
        ["ID", "SKU", "Barcode", "ชื่อสินค้า", "หมวดหมู่", "หมวดย่อย", "โซน", "หน่วย", "ต้นทุน", "ราคาขาย", "คงเหลือ", "ขั้นต่ำ", "เป้าหมาย", "สถานะ", "อัปเดตล่าสุด"],
        ...products.map((p) => [
          cell(p.id), cell(p.sku), cell(p.barcode), cell(p.name), cell(p.categoryId),
          cell(p.subCategoryId), cell(p.zoneId), cell(p.unitId), cell(p.costPrice),
          cell(p.sellPrice), cell(p.stock), cell(p.minStock), cell(p.targetStock),
          p.isActive === false ? "ระงับ" : "ใช้งาน", cell(p.updatedAt),
        ]),
      ],
    },
    {
      title: "📝 การเคลื่อนไหวสต็อก",
      rows: [
        ["ID", "วันที่", "Product ID", "สินค้า", "Barcode", "ประเภท", "จำนวน", "ก่อนหน้า", "คงเหลือใหม่", "ผู้ทำรายการ", "หมายเหตุ"],
        ...movements.map((m) => [
          cell(m.id), cell(m.timestamp), cell(m.productId), cell(m.productName), cell(m.barcode),
          cell(m.type), cell(m.quantity), cell(m.previousStock), cell(m.newStock),
          cell(m.operator), cell(m.note),
        ]),
      ],
    },
    {
      title: "📋 ใบสั่งซื้อ",
      rows: [
        ["ID", "เลขที่ PO", "วันที่", "ผู้ขาย", "สถานะ", "จำนวนรวม", "มูลค่ารวม", "รายการสินค้า"],
        ...orders.map((o) => [
          cell(o.id), cell(o.orderNumber), cell(o.createdAt), cell(o.supplierName),
          cell(o.status), cell(o.totalQuantity), cell(o.totalCost), cell(o.items),
        ]),
      ],
    },
    {
      title: "🏷️ ข้อมูลหลัก",
      rows: [
        ["ประเภท", "ID", "รหัส", "ชื่อ", "ข้อมูลเพิ่มเติม"],
        ...categories.map((v) => ["หมวดหมู่", cell(v.id), cell(v.code), cell(v.name), ""]),
        ...(snapshot.subCategories ?? []).map((v) => ["หมวดหมู่ย่อย", cell(v.id), cell(v.code), cell(v.name), cell(v.categoryId)]),
        ...(snapshot.zones ?? []).map((v) => ["โซน", cell(v.id), cell(v.code), cell(v.name), cell(v.description)]),
        ...(snapshot.units ?? []).map((v) => ["หน่วยนับ", cell(v.id), "", cell(v.name), cell(v.shortName)]),
      ],
    },
    {
      title: "⚙️ สำรองดิบ_JSON",
      rows: [["ข้อมูล JSON สำรองฉบับเต็ม"], [raw]],
    },
  ];
}

async function googleSheetsRequest<T>(
  url: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");
  if (init?.body) headers.set("Content-Type", "application/json");
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google Sheets API (${response.status}): ${detail}`);
  }
  return (await response.json()) as T;
}

export async function backupDatabaseToGoogleSheetsServer(options?: {
  spreadsheetId?: string;
}): Promise<ServerBackupResult> {
  try {
    if (!isPostgresConfigured()) {
      throw new Error("ไม่พบการตั้งค่า PostgreSQL หลัก จึงยกเลิกการสำรองข้อมูล");
    }

    const credentials = await resolveServiceAccount();
    if (!credentials) {
      throw new Error("ยังไม่ได้กำหนด Service Account ใน Railway Variables");
    }

    const snapshot = await getDatabaseSnapshot();
    const tabs = buildServerBackupTabs(snapshot);
    const token = await mintServiceAccountAccessToken(credentials);
    const targetId = options?.spreadsheetId
      ? extractSpreadsheetId(options.spreadsheetId)
      : credentials.spreadsheetId;

    const spreadsheetId =
      targetId ||
      extractSpreadsheetId(
        (await getBindingOrEnv("GOOGLE_SPREADSHEET_ID")) ||
          (await getBindingOrEnv("SPREADSHEET_ID")) ||
          (await getBindingOrEnv("GOOGLE_SHEET_ID")) ||
          (await getBindingOrEnv("SHEET_ID")) ||
          "",
      );
    if (!spreadsheetId) {
      throw new Error("กรุณากำหนด GOOGLE_SPREADSHEET_ID ใน Railway Variables ก่อนเปิดใช้ Server Backup");
    }

    const metadata = await googleSheetsRequest<{
      properties?: { title?: string };
      sheets?: Array<{ properties?: { title?: string } }>;
    }>(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=properties.title,sheets.properties.title`,
      token,
    );
    const spreadsheetTitle = metadata.properties?.title || "Google Sheets Backup";
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
    const existingTitles = new Set((metadata.sheets ?? []).map((sheet) => sheet.properties?.title || ""));
    const missingTabs = tabs.filter((tab) => !existingTitles.has(tab.title));
    if (missingTabs.length > 0) {
      await googleSheetsRequest(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
        token,
        {
          method: "POST",
          body: JSON.stringify({
            requests: missingTabs.map((tab) => ({ addSheet: { properties: { title: tab.title } } })),
          }),
        },
      );
    }
    await googleSheetsRequest(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchClear`,
      token,
      { method: "POST", body: JSON.stringify({ ranges: tabs.map((tab) => `'${tab.title}'!A:Z`) }) },
    );

    await googleSheetsRequest(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
      token,
      {
        method: "POST",
        body: JSON.stringify({
          valueInputOption: "RAW",
          data: tabs.map((tab) => ({ range: `'${tab.title}'!A1`, values: tab.rows })),
        }),
      },
    );

    const backedUpAt = new Date().toISOString();
    const result: ServerBackupResult = {
      success: true,
      message: "สำรองข้อมูลจาก PostgreSQL ไปยัง Google Sheets สำเร็จ",
      spreadsheetId,
      spreadsheetTitle,
      spreadsheetUrl,
      backedUpAt,
      stats: {
        products: snapshot.products.length,
        movements: snapshot.movements.length,
        orders: snapshot.purchaseOrders.length,
        categories: snapshot.categories.length,
      },
    };
    lastServerBackupStatus = { ...result, checkedAt: backedUpAt };
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    lastServerBackupStatus = { success: false, error: message, checkedAt: new Date().toISOString() };
    throw error;
  }
}

export function scheduleAutoBackupToServerSheets(): void {
  if (envGet("GOOGLE_SHEETS_AUTO_BACKUP") !== "true") return;
  if (serverAutoBackupTimer) clearTimeout(serverAutoBackupTimer);
  serverAutoBackupTimer = setTimeout(() => {
    serverAutoBackupTimer = null;
    if (serverBackupInProgress) {
      scheduleAutoBackupToServerSheets();
      return;
    }
    serverBackupInProgress = true;
    void backupDatabaseToGoogleSheetsServer()
      .catch((error) => {
        console.error("[GoogleSheets] Scheduled server backup failed:", error);
      })
      .finally(() => {
        serverBackupInProgress = false;
      });
  }, 15000);
}

export const backupMasterDataToSheetsFn = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const d1 = await getD1Snapshot();
    return {
      success: true,
      message: d1 ? `D1 snapshot ready (${d1.products?.length || 0} products)` : "No D1 data",
      source: d1 ? "d1" : "none",
    } as ServerBackupResult & { source: string };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    } as ServerBackupResult;
  }
});

export const triggerServerBackupToGoogleSheetsFn = createServerFn({ method: "POST" })
  .validator((data: { spreadsheetId?: string | undefined }) => data)
  .handler(async ({ data }) => {
    try {
      return await backupDatabaseToGoogleSheetsServer({
        spreadsheetId: data?.spreadsheetId,
      });
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });
