import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db, favoritesTable, businessesTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router = Router();

router.get("/favorites", requireAuth, async (req: AuthRequest, res) => {
  const rows = await db
    .select({ favorite: favoritesTable, business: businessesTable })
    .from(favoritesTable)
    .leftJoin(businessesTable, eq(favoritesTable.businessId, businessesTable.id))
    .where(eq(favoritesTable.userId, req.userId!));
  res.json(rows.map((r) => ({ ...r.favorite, business: r.business })));
});

router.post("/favorites/:businessId", requireAuth, async (req: AuthRequest, res) => {
  const businessId = req.params.businessId as string;
  const [biz] = await db.select({ id: businessesTable.id }).from(businessesTable).where(eq(businessesTable.id, businessId)).limit(1);
  if (!biz) { res.status(404).json({ error: "Business introuvable" }); return; }
  try {
    const [fav] = await db.insert(favoritesTable).values({ userId: req.userId!, businessId }).returning();
    res.status(201).json(fav);
  } catch {
    res.status(409).json({ error: "Déjà dans les favoris" });
  }
});

router.delete("/favorites/:businessId", requireAuth, async (req: AuthRequest, res) => {
  const businessId = req.params.businessId as string;
  await db.delete(favoritesTable).where(and(eq(favoritesTable.userId, req.userId!), eq(favoritesTable.businessId, businessId)));
  res.json({ ok: true });
});

export default router;
