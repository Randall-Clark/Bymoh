import { Router } from "express";
import { and, eq, gt } from "drizzle-orm";
import { db, usersTable, otpCodesTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../lib/auth";
import fs from "node:fs";
import path from "node:path";

const router = Router();

// ── Upload dir setup ────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "avatars");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── GET /users/me ───────────────────────────────────────────────────────────
router.get("/users/me", requireAuth, async (req: AuthRequest, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }
  const { pinHash: _p, ...safe } = user;
  res.json(safe);
});

// ── PATCH /users/me ─────────────────────────────────────────────────────────
router.patch("/users/me", requireAuth, async (req: AuthRequest, res) => {
  const { name, email, avatarUrl } = req.body as {
    name?: string; email?: string; avatarUrl?: string;
  };
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (name) updates.name = name.trim();
  if (email !== undefined) updates.email = email.trim() || null;
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl || null;
  updates.updatedAt = new Date();

  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, req.userId!)).returning();
  if (!user) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }
  const { pinHash: _p, ...safe } = user;
  res.json(safe);
});

// ── POST /users/me/avatar ────────────────────────────────────────────────────
// Accepts base64-encoded image, saves to disk, updates avatar_url
router.post("/users/me/avatar", requireAuth, async (req: AuthRequest, res) => {
  const { imageBase64, mimeType } = req.body as { imageBase64?: string; mimeType?: string };
  if (!imageBase64 || !mimeType) {
    res.status(400).json({ error: "imageBase64 et mimeType requis" }); return;
  }
  const ext = mimeType.split("/")[1] ?? "jpg";
  const filename = `${req.userId!}.${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);
  const buffer = Buffer.from(imageBase64.replace(/^data:[^;]+;base64,/, ""), "base64");
  fs.writeFileSync(filepath, buffer);

  const avatarUrl = `/api/uploads/avatars/${filename}`;
  const [user] = await db
    .update(usersTable)
    .set({ avatarUrl, updatedAt: new Date() })
    .where(eq(usersTable.id, req.userId!))
    .returning();
  if (!user) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }
  const { pinHash: _p, ...safe } = user;
  res.json(safe);
});

// ── POST /users/me/phone/otp ─────────────────────────────────────────────────
// Request an OTP to verify a phone number change
router.post("/users/me/phone/otp", requireAuth, async (req: AuthRequest, res) => {
  const { newPhone, channel } = req.body as { newPhone?: string; channel?: "sms" | "email" };

  if (!newPhone || !channel) {
    res.status(400).json({ error: "newPhone et channel requis" }); return;
  }
  if (!["sms", "email"].includes(channel)) {
    res.status(400).json({ error: "channel doit être 'sms' ou 'email'" }); return;
  }

  // Check new phone not already taken
  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.phone, newPhone.trim()))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "Ce numéro est déjà utilisé par un autre compte." }); return;
  }

  // Fetch current user
  const [currentUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1);
  if (!currentUser) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }

  if (channel === "email" && !currentUser.email) {
    res.status(400).json({ error: "Aucun e-mail associé à votre compte. Ajoutez d'abord une adresse e-mail." }); return;
  }

  // Generate 6-digit OTP
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Invalidate previous OTPs for this user+purpose
  await db
    .update(otpCodesTable)
    .set({ used: true })
    .where(and(eq(otpCodesTable.userId, req.userId!), eq(otpCodesTable.purpose, "phone_change"), eq(otpCodesTable.used, false)));

  await db.insert(otpCodesTable).values({
    userId: req.userId!,
    otp,
    newPhone: newPhone.trim(),
    channel,
    purpose: "phone_change",
    expiresAt,
    used: false,
  });

  // Log OTP (production: send real SMS / email here)
  const target = channel === "sms" ? currentUser.phone : currentUser.email;
  req.log.info({ channel, target, otp }, "[DEV] Phone change OTP");

  // Masked delivery target for the response
  const maskedTarget = channel === "sms"
    ? currentUser.phone.slice(0, -4).replace(/\d/g, "•") + currentUser.phone.slice(-4)
    : currentUser.email!.replace(/^(.{2})(.+)(@.+)$/, (_, a, b, c) => a + "•".repeat(b.length) + c);

  res.json({
    sent: true,
    channel,
    maskedTarget,
    // DEV ONLY — remove in production
    devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
  });
});

// ── POST /users/me/phone/confirm ─────────────────────────────────────────────
// Confirm OTP and update phone number
router.post("/users/me/phone/confirm", requireAuth, async (req: AuthRequest, res) => {
  const { newPhone, otp } = req.body as { newPhone?: string; otp?: string };

  if (!newPhone || !otp) {
    res.status(400).json({ error: "newPhone et otp requis" }); return;
  }

  const now = new Date();
  const [code] = await db
    .select()
    .from(otpCodesTable)
    .where(
      and(
        eq(otpCodesTable.userId, req.userId!),
        eq(otpCodesTable.otp, otp.trim()),
        eq(otpCodesTable.newPhone, newPhone.trim()),
        eq(otpCodesTable.purpose, "phone_change"),
        eq(otpCodesTable.used, false),
        gt(otpCodesTable.expiresAt, now),
      ),
    )
    .limit(1);

  if (!code) {
    res.status(400).json({ error: "Code OTP invalide ou expiré." }); return;
  }

  // Mark OTP as used
  await db.update(otpCodesTable).set({ used: true }).where(eq(otpCodesTable.id, code.id));

  // Update phone
  const [user] = await db
    .update(usersTable)
    .set({ phone: newPhone.trim(), updatedAt: new Date() })
    .where(eq(usersTable.id, req.userId!))
    .returning();
  if (!user) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }
  const { pinHash: _p, ...safe } = user;
  res.json(safe);
});

export default router;
