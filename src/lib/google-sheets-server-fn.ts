import { createServerFn } from "@tanstack/react-start";
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

let runtimeServiceAccount: ServiceAccountCredentials | null = null;
let cachedServiceAccountToken: { token: string; expiresAt: number } | null = null;

/** Never reference free variable process at module load (Safari throws ReferenceError). */
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
  } catch {
    // ignore
  }
  try {
    const modName = "cloudflare" + ":workers";
    const mod = (await import(/* @vite-ignore */ modName)) as { env?: Record<string, unknown> };
    const val = mod?.env?.[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  } catch {
    // ignore
  }
  return "";
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

/** WebCrypto RS256 JWT for Google OAuth (works on Workers + browser, no node:crypto). */
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
    scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file",
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
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(toSign),
  );
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
  return {
    isConfigured: Boolean(creds?.clientEmail && creds?.privateKey),
    clientEmail: creds?.clientEmail ?? null,
    spreadsheetId:
      creds?.spreadsheetId || (envSpreadsheetId ? extractSpreadsheetId(envSpreadsheetId) : null),
    source: creds ? (rawEnvJson ? ("env" as const) : ("runtime" as const)) : ("none" as const),
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
  .handler(async ({ data }) => {
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
    return {
      success: true,
      clientEmail: email,
      spreadsheetId: cleanSpreadsheetId || null,
      message: "บันทึก Service Account สำเร็จ",
    };
  });

export const disconnectGoogleSheetsConfigFn = createServerFn({ method: "POST" }).handler(
  async () => {
    runtimeServiceAccount = null;
    cachedServiceAccountToken = null;
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
  .handler(async ({ data }) => {
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
        return { success: true, spreadsheetId: null, title: "Google Service Account" };
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
      return {
        success: true,
        spreadsheetId: meta.spreadsheetId || targetId,
        title: meta.properties?.title || "Spreadsheet",
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

/** No-op on Cloudflare (disk backup not available); D1 is primary. */
export function scheduleAutoBackupToServerSheets(): void {
  // intentionally empty on Workers — avoids process/fs at module load
}

export type ServerBackupResult = {
  success: boolean;
  message?: string;
  error?: string;
};

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

export const triggerServerBackupToGoogleSheetsFn = createServerFn({ method: "POST" }).handler(
  async () => {
    try {
      const d1 = await getD1Snapshot();
      return {
        success: true,
        message: d1
          ? `D1 snapshot ready (${d1.products?.length || 0} products)`
          : "No D1 binding — backup skipped on Workers",
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
);
