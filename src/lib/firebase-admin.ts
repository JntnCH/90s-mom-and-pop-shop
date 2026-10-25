import { initializeApp, getApps, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

const configFiles = import.meta.glob<Record<string, string>>("../../firebase-applet-config.json", {
  eager: true,
  import: "default",
});

function envGet(key: string): string {
  try {
    const g = globalThis as unknown as { process?: { env?: Record<string, string | undefined> } };
    const val = g.process?.env?.[key];
    return typeof val === "string" ? val : "";
  } catch {
    return "";
  }
}

const firebaseConfig = configFiles["../../firebase-applet-config.json"] || {
  projectId:
    envGet("VITE_FIREBASE_PROJECT_ID") ||
    envGet("FIREBASE_PROJECT_ID") ||
    envGet("PROJECT_ID") ||
    "openclaw-gcp-272026",
};

let adminAppInstance: App | null = null;
let adminAuthInstance: Auth | null = null;

try {
  if (!getApps().length) {
    adminAppInstance = initializeApp({
      projectId: firebaseConfig.projectId,
    });
  } else {
    adminAppInstance = getApps()[0];
  }
  adminAuthInstance = getAuth(adminAppInstance);
} catch (err) {
  console.warn("[Firebase Admin] Initialization failed:", err);
}

export const adminApp = adminAppInstance;
export const adminAuth = adminAuthInstance;
