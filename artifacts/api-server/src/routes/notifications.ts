import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router = Router();

router.get("/notifications", requireAuth, async (req: AuthRequest, res) => {
  const notifs = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, req.userId!))
    .orderBy(notificationsTable.createdAt);
  res.json(notifs);
});

router.patch("/notifications/:id/read", requireAuth, async (req: AuthRequest, res) => {
  const id = req.params.id as string;
  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.id, id));
  res.json({ ok: true });
});

router.patch("/notifications/read-all", requireAuth, async (req: AuthRequest, res) => {
  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.userId, req.userId!));
  res.json({ ok: true });
});

export default router;
