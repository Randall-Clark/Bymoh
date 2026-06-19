import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { hashPin, signToken } from "../lib/auth";

const router = Router();

router.post("/auth/check-phone", async (req, res) => {
  const { phone } = req.body as { phone?: string };
  if (!phone) { res.status(400).json({ error: "Numéro requis" }); return; }
  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.phone, phone)).limit(1);
  res.json({ exists: !!user });
});

router.post("/auth/register", async (req, res) => {
  const { phone, name, email, pin } = req.body as {
    phone?: string; name?: string; email?: string; pin?: string;
  };
  if (!phone || !name || !pin) { res.status(400).json({ error: "Champs manquants (phone, name, pin)" }); return; }
  if (pin.length !== 6) { res.status(400).json({ error: "Le PIN doit avoir 6 chiffres" }); return; }

  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.phone, phone)).limit(1);
  if (existing) { res.status(409).json({ error: "Ce numéro est déjà utilisé" }); return; }

  const [user] = await db.insert(usersTable).values({
    phone,
    name: name.trim(),
    email: email?.trim() || null,
    pinHash: hashPin(pin),
    role: "client",
  }).returning();

  const token = signToken(user.id);
  res.status(201).json({ user: safeUser(user), token });
});

router.post("/auth/login", async (req, res) => {
  const { phone, pin } = req.body as { phone?: string; pin?: string };
  if (!phone || !pin) { res.status(400).json({ error: "Numéro et PIN requis" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.phone, phone)).limit(1);
  if (!user) { res.status(401).json({ error: "Aucun compte pour ce numéro" }); return; }
  if (!user.isActive) { res.status(403).json({ error: "Compte désactivé" }); return; }
  if (user.pinHash !== hashPin(pin)) { res.status(401).json({ error: "PIN incorrect" }); return; }

  const token = signToken(user.id);
  res.json({ user: safeUser(user), token });
});

function safeUser(u: typeof usersTable.$inferSelect) {
  const { pinHash: _p, ...rest } = u;
  return rest;
}

export default router;
