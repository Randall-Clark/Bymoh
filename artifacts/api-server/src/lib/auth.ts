import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";

const SECRET = process.env.SESSION_SECRET ?? "kola-dev-secret";

export function hashPin(pin: string): string {
  return crypto.createHmac("sha256", SECRET).update(pin).digest("hex");
}

export function signToken(userId: string): string {
  const timestamp = Date.now().toString();
  const payload = `${userId}:${timestamp}`;
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const lastColon = decoded.lastIndexOf(":");
    const sig = decoded.slice(lastColon + 1);
    const payload = decoded.slice(0, lastColon);
    const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
    if (sig !== expected) return null;
    const colonIdx = payload.indexOf(":");
    const userId = payload.slice(0, colonIdx);
    const timestamp = parseInt(payload.slice(colonIdx + 1));
    if (Date.now() - timestamp > 30 * 24 * 60 * 60 * 1000) return null;
    return { userId };
  } catch {
    return null;
  }
}

export interface AuthRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  const token = auth.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Token invalide ou expiré" });
    return;
  }
  req.userId = payload.userId;
  next();
}
