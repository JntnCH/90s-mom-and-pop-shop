import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth } from "../lib/firebase-admin.ts";

export interface AuthRequest {
  headers: { authorization?: string | undefined };
  user?: DecodedIdToken;
}

interface AuthResponse {
  status(code: number): AuthResponse;
  json(body: { error: string }): unknown;
}

type NextFunction = () => void;

export const requireAuth = async (req: AuthRequest, res: AuthResponse, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: Missing token" });
    return;
  }

  if (!adminAuth) {
    res.status(503).json({ error: "Service Unavailable: Firebase Admin not configured" });
    return;
  }

  const token = authHeader.slice("Bearer ".length);
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Error verifying Firebase ID token:", error);
    res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};
