import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";

const configFiles = import.meta.glob<Record<string, string>>("../../firebase-applet-config.json", {
  eager: true,
  import: "default",
});

const fileConfig = configFiles["../../firebase-applet-config.json"];

export const firebaseConfig = {
  apiKey: fileConfig?.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: fileConfig?.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId:
    fileConfig?.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || "openclaw-gcp-272026",
  storageBucket: fileConfig?.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId:
    fileConfig?.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: fileConfig?.appId || import.meta.env.VITE_FIREBASE_APP_ID || "",
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.apiKey.trim() !== "",
);

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;

if (isFirebaseConfigured) {
  try {
    appInstance = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    authInstance = getAuth(appInstance);
  } catch (err) {
    console.warn("[Firebase] Client initialization failed:", err);
  }
}

export const app = appInstance;
export const auth = authInstance;
export const googleAuthProvider = new GoogleAuthProvider();
