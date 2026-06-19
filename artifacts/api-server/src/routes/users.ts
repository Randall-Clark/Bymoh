import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router = Router();

router.get("/users/me", requireAuth, async (req: AuthRequest, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }
  const { pinHash: _p, ...safe } = user;
  res.json(safe);
});

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

export default router;
