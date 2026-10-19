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
    if (fs.existsSync(PERSISTENT_CONFIG_PATH)) {
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
 * Resolve Service Account credentials from Environment or Runtime config
 */
function resolveServiceAccount(): ServiceAccountCredentials | null {
  if (runtimeServiceAccount?.clientEmail && runtimeServiceAccount?.privateKey) {
    return runtimeServiceAccount;
  }

  // 1. Check persisted config on disk (.data/google-service-account.json)
  const persisted = readPersistedConfig();
  if (persisted?.clientEmail && persisted?.privateKey) {
    runtimeServiceAccount = persisted;
    return persisted;
  }

  // 2. Check GOOGLE_SERVICE_ACCOUNT_JSON
  const rawJson = (
    process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] ||
    process.env["GOOGLE_SERVICE_ACCOUNT"] ||
    process.env["SERVICE_ACCOUNT_JSON"] ||
    ""
  ).trim();

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
          privateKey: privateKey.trim(),
          projectId: projectId?.trim(),
          spreadsheetId:
            (process.env["GOOGLE_SPREADSHEET_ID"] || process.env["SPREADSHEET_ID"] || "").trim() ||
            undefined,
        };
      }
    } catch (err) {
      console.warn("[GoogleSheets] Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:", err);
    }
  }

  // 3. Check discrete env vars
  const email = (
    process.env["GOOGLE_SERVICE_ACCOUNT_EMAIL"] ||
    process.env["SERVICE_ACCOUNT_EMAIL"] ||
    ""
  ).trim();

  const key = (
    process.env["GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"] ||
    process.env["SERVICE_ACCOUNT_PRIVATE_KEY"] ||
    process.env["GOOGLE_PRIVATE_KEY"] ||
    ""
  ).trim();

  if (email && key) {
    return {
      clientEmail: email,
      privateKey: key,
      spreadsheetId:
        (process.env["GOOGLE_SPREADSHEET_ID"] || process.env["SPREADSHEET_ID"] || "").trim() ||
        undefined,
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

  // Ensure escaped newlines in private key are converted to actual newlines
  const formattedKey = credentials.privateKey.replace(/\\n/g, "\n");

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
 * Server Function: Get Google Sheets Configuration Status
 */
export const getGoogleSheetsConfigFn = createServerFn({ method: "GET" }).handler(async () => {
  const creds = resolveServiceAccount();
  const envSpreadsheetId = (
    process.env["GOOGLE_SPREADSHEET_ID"] ||
    process.env["SPREADSHEET_ID"] ||
    ""
  ).trim();

  const isFromEnv = Boolean(
    process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] || process.env["GOOGLE_SERVICE_ACCOUNT_EMAIL"],
  );
  const isFromFile = Boolean(!isFromEnv && fs.existsSync(PERSISTENT_CONFIG_PATH));

  return {
    isConfigured: Boolean(creds?.clientEmail && creds?.privateKey),
    clientEmail: creds?.clientEmail ?? null,
    spreadsheetId: creds?.spreadsheetId || envSpreadsheetId || null,
    source: creds
      ? isFromEnv
        ? ("env" as const)
        : isFromFile
          ? ("file" as const)
          : ("runtime" as const)
      : ("none" as const),
    projectId: creds?.projectId ?? null,
  };
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
  const creds = resolveServiceAccount();
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
    const creds = resolveServiceAccount();
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
