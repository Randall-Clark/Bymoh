import { Router } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, reviewsTable, usersTable, businessesTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router = Router();

router.get("/businesses/:id/reviews", async (req, res) => {
  const bizId = req.params.id as string;
  const rows = await db
    .select({ review: reviewsTable, userName: usersTable.name, userAvatar: usersTable.avatarUrl })
    .from(reviewsTable)
    .leftJoin(usersTable, eq(reviewsTable.userId, usersTable.id))
    .where(eq(reviewsTable.businessId, bizId))
    .orderBy(reviewsTable.createdAt);
  res.json(rows);
});

router.post("/businesses/:id/reviews", requireAuth, async (req: AuthRequest, res) => {
  const bizId = req.params.id as string;
  const { rating, comment } = req.body as { rating?: number; comment?: string };
  if (!rating || rating < 1 || rating > 5) {
    res.status(400).json({ error: "rating doit être entre 1 et 5" }); return;
  }
  const [biz] = await db.select({ id: businessesTable.id }).from(businessesTable)
    .where(eq(businessesTable.id, bizId)).limit(1);
  if (!biz) { res.status(404).json({ error: "Business introuvable" }); return; }

  let review;
  try {
    const [r] = await db.insert(reviewsTable).values({
      userId: req.userId!, businessId: bizId, rating, comment: comment ?? null,
    }).returning();
    review = r;
  } catch {
    const [existing] = await db.update(reviewsTable)
      .set({ rating, comment: comment ?? null, updatedAt: new Date() })
      .where(and(eq(reviewsTable.userId, req.userId!), eq(reviewsTable.businessId, bizId)))
      .returning();
    review = existing;
  }

  const statsRows = await db
    .select({
      avgRating: sql<number>`ROUND(AVG(rating)::numeric, 1)`,
      cnt: sql<number>`COUNT(*)::int`,
    })
    .from(reviewsTable)
    .where(eq(reviewsTable.businessId, bizId));

  if (statsRows[0]) {
    await db.update(businessesTable).set({
      rating: Number(statsRows[0].avgRating) || 0,
      reviewCount: Number(statsRows[0].cnt) || 0,
    }).where(eq(businessesTable.id, bizId));
  }

  res.status(201).json(review);
});

export default router;
