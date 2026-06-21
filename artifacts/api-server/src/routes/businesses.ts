import { Router } from "express";
import { and, count, eq, ilike, or, sql, sum } from "drizzle-orm";
import { db, businessesTable, businessHoursTable, bookingsTable, ordersTable, orderItemsTable, servicesTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router = Router();

router.get("/businesses", async (req, res) => {
  const { category, city, search, hasDelivery } = req.query as Record<string, string>;
  const conditions = [eq(businessesTable.isActive, true)];
  if (category) conditions.push(eq(businessesTable.category, category));
  if (city) conditions.push(eq(businessesTable.city, city));
  if (hasDelivery === "true") conditions.push(eq(businessesTable.hasDelivery, true));
  if (search) {
    conditions.push(
      or(
        ilike(businessesTable.name, `%${search}%`),
        ilike(businessesTable.description, `%${search}%`),
        ilike(businessesTable.category, `%${search}%`),
      )!,
    );
  }
  const businesses = await db.select().from(businessesTable).where(and(...conditions)).orderBy(businessesTable.rating);
  res.json(businesses);
});

router.get("/businesses/mine", requireAuth, async (req: AuthRequest, res) => {
  const businesses = await db.select().from(businessesTable)
    .where(eq(businessesTable.ownerId, req.userId!))
    .orderBy(businessesTable.createdAt);
  res.json(businesses);
});

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

router.patch("/businesses/:id/active", requireAuth, async (req: AuthRequest, res) => {
  const id = req.params.id as string;
  const { isActive } = req.body as { isActive?: boolean };
  if (typeof isActive !== "boolean") {
    res.status(400).json({ error: "isActive (boolean) requis" }); return;
  }
  const [biz] = await db.select({
    ownerId: businessesTable.ownerId,
    pausedAt: businessesTable.pausedAt,
  }).from(businessesTable).where(eq(businessesTable.id, id)).limit(1);
  if (!biz) { res.status(404).json({ error: "Business introuvable" }); return; }
  if (biz.ownerId !== req.userId) { res.status(403).json({ error: "Accès refusé" }); return; }

  if (isActive && biz.pausedAt) {
    const elapsed = Date.now() - new Date(biz.pausedAt).getTime();
    if (elapsed > THREE_DAYS_MS) {
      res.status(403).json({
        error: "Délai de réactivation expiré",
        code: "PAUSE_EXPIRED",
        message: "Le délai de 3 jours est dépassé. Votre business est définitivement fermé. Pour rouvrir, veuillez créer un nouveau commerce.",
      }); return;
    }
  }

  const now = new Date();
  const updateData = isActive
    ? { isActive: true, pausedAt: null as null, updatedAt: now }
    : { isActive: false, pausedAt: now, updatedAt: now };

  const [updated] = await db.update(businessesTable)
    .set(updateData)
    .where(eq(businessesTable.id, id)).returning();
  res.json(updated);
});

router.get("/businesses/:id", async (req, res) => {
  const id = req.params.id as string;
  const [business] = await db.select().from(businessesTable)
    .where(and(eq(businessesTable.id, id), eq(businessesTable.isActive, true))).limit(1);
  if (!business) { res.status(404).json({ error: "Business introuvable" }); return; }
  const [hours, services] = await Promise.all([
    db.select().from(businessHoursTable).where(eq(businessHoursTable.businessId, id)),
    db.select().from(servicesTable).where(and(eq(servicesTable.businessId, id), eq(servicesTable.isAvailable, true))),
  ]);
  res.json({ ...business, hours, services });
});

router.post("/businesses", requireAuth, async (req: AuthRequest, res) => {
  const b = req.body as Record<string, unknown>;
  const { name, category, phone, address } = b;
  if (!name || !category || !phone || !address) {
    res.status(400).json({ error: "Champs requis : name, category, phone, address" }); return;
  }
  const [{ bizCount }] = await db.select({ bizCount: count() }).from(businessesTable)
    .where(eq(businessesTable.ownerId, req.userId!));
  if ((bizCount ?? 0) >= 3) {
    res.status(403).json({ error: "Limite atteinte. Vous ne pouvez pas enregistrer plus de 3 commerces." }); return;
  }
  const [business] = await db.insert(businessesTable).values({
    ownerId: req.userId!,
    name: name as string,
    category: category as string,
    phone: phone as string,
    address: address as string,
    categoryIcon: (b.categoryIcon as string) ?? "briefcase",
    sector: (b.sector as string) ?? null,
    description: (b.description as string) ?? "",
    email: (b.email as string) ?? null,
    city: (b.city as string) ?? "Lomé",
    coverUrl: (b.coverUrl as string) ?? null,
    hasDelivery: (b.hasDelivery as boolean) ?? false,
    bookingMode: (b.bookingMode as "table" | "service" | "none") ?? "service",
    latitude: (b.latitude as number) ?? null,
    longitude: (b.longitude as number) ?? null,
    employeeCount: (b.employeeCount as number) ?? null,
  }).returning();
  res.status(201).json(business);
});

router.patch("/businesses/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = req.params.id as string;
  const [biz] = await db.select({ ownerId: businessesTable.ownerId }).from(businessesTable)
    .where(eq(businessesTable.id, id)).limit(1);
  if (!biz) { res.status(404).json({ error: "Business introuvable" }); return; }
  if (biz.ownerId !== req.userId) { res.status(403).json({ error: "Accès refusé" }); return; }
  const [updated] = await db.update(businessesTable)
    .set({ ...req.body, updatedAt: new Date() }).where(eq(businessesTable.id, id)).returning();
  res.json(updated);
});

router.get("/businesses/:id/services", async (req, res) => {
  const id = req.params.id as string;
  const services = await db.select().from(servicesTable)
    .where(and(eq(servicesTable.businessId, id), eq(servicesTable.isAvailable, true)));
  res.json(services);
});

router.post("/businesses/:id/services", requireAuth, async (req: AuthRequest, res) => {
  const id = req.params.id as string;
  const [biz] = await db.select({ ownerId: businessesTable.ownerId }).from(businessesTable)
    .where(eq(businessesTable.id, id)).limit(1);
  if (!biz) { res.status(404).json({ error: "Business introuvable" }); return; }
  if (biz.ownerId !== req.userId) { res.status(403).json({ error: "Accès refusé" }); return; }
  const body = req.body as Partial<typeof servicesTable.$inferInsert>;
  if (!body.title || body.price === undefined) { res.status(400).json({ error: "title et price requis" }); return; }
  const [service] = await db.insert(servicesTable).values({
    businessId: id,
    title: body.title,
    price: body.price,
    description: body.description ?? "",
    currency: body.currency ?? "FCFA",
    imageUrl: body.imageUrl ?? null,
    durationMinutes: body.durationMinutes ?? null,
  }).returning();
  res.status(201).json(service);
});

router.patch("/businesses/:bizId/services/:serviceId", requireAuth, async (req: AuthRequest, res) => {
  const bizId = req.params.bizId as string;
  const serviceId = req.params.serviceId as string;
  const [biz] = await db.select({ ownerId: businessesTable.ownerId }).from(businessesTable)
    .where(eq(businessesTable.id, bizId)).limit(1);
  if (!biz || biz.ownerId !== req.userId) { res.status(403).json({ error: "Accès refusé" }); return; }
  const [updated] = await db.update(servicesTable).set(req.body).where(eq(servicesTable.id, serviceId)).returning();
  res.json(updated);
});

// ─── Catalogue (pro) ────────────────────────────────────────────────────────

function toApiItem(row: typeof servicesTable.$inferSelect) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    description: row.description,
    price: row.price,
    currency: row.currency,
    photo: row.imageUrl ?? undefined,
    category: row.category ?? undefined,
    unit: row.unit ?? undefined,
    stockQty: row.stockQty ?? null,
    showStock: row.showStock,
    duration: row.durationMinutes ?? undefined,
    billingType: row.billingType,
    allowsBooking: row.allowsBooking,
    isAvailable: row.isAvailable,
    createdAt: row.createdAt,
  };
}

router.get("/businesses/:id/catalog", requireAuth, async (req: AuthRequest, res) => {
  const id = req.params.id as string;
  const [biz] = await db.select({ ownerId: businessesTable.ownerId }).from(businessesTable)
    .where(eq(businessesTable.id, id)).limit(1);
  if (!biz) { res.status(404).json({ error: "Business introuvable" }); return; }
  if (biz.ownerId !== req.userId) { res.status(403).json({ error: "Accès refusé" }); return; }
  const rows = await db.select().from(servicesTable)
    .where(eq(servicesTable.businessId, id))
    .orderBy(servicesTable.createdAt);
  res.json(rows.map(toApiItem));
});

router.post("/businesses/:id/catalog", requireAuth, async (req: AuthRequest, res) => {
  const id = req.params.id as string;
  const [biz] = await db.select({ ownerId: businessesTable.ownerId }).from(businessesTable)
    .where(eq(businessesTable.id, id)).limit(1);
  if (!biz) { res.status(404).json({ error: "Business introuvable" }); return; }
  if (biz.ownerId !== req.userId) { res.status(403).json({ error: "Accès refusé" }); return; }
  const body = req.body as Record<string, unknown>;
  if (!body.title || body.price === undefined) {
    res.status(400).json({ error: "title et price requis" }); return;
  }
  const kind = (body.kind as "article" | "prestation") ?? "prestation";
  const [row] = await db.insert(servicesTable).values({
    businessId: id,
    kind,
    title: body.title as string,
    description: (body.description as string) ?? "",
    price: body.price as number,
    currency: (body.currency as string) ?? "FCFA",
    imageUrl: (body.photo as string) ?? null,
    durationMinutes: kind === "prestation" ? ((body.duration as number) ?? null) : null,
    billingType: kind === "prestation" ? ((body.billingType as "fixed" | "hourly") ?? "fixed") : "fixed",
    allowsBooking: kind === "prestation" ? ((body.allowsBooking as boolean) ?? true) : false,
    category: kind === "article" ? ((body.category as string) ?? null) : null,
    unit: kind === "article" ? ((body.unit as string) ?? null) : null,
    stockQty: kind === "article" ? ((body.stockQty as number | null) ?? null) : null,
    showStock: kind === "article" ? ((body.showStock as boolean) ?? false) : false,
  }).returning();
  res.status(201).json(toApiItem(row));
});

router.patch("/businesses/:bizId/catalog/:itemId", requireAuth, async (req: AuthRequest, res) => {
  const bizId = req.params.bizId as string;
  const itemId = req.params.itemId as string;
  const [biz] = await db.select({ ownerId: businessesTable.ownerId }).from(businessesTable)
    .where(eq(businessesTable.id, bizId)).limit(1);
  if (!biz || biz.ownerId !== req.userId) { res.status(403).json({ error: "Accès refusé" }); return; }
  const body = req.body as Record<string, unknown>;
  const updateData: Partial<typeof servicesTable.$inferInsert> = {};
  if (body.title !== undefined) updateData.title = body.title as string;
  if (body.description !== undefined) updateData.description = body.description as string;
  if (body.price !== undefined) updateData.price = body.price as number;
  if (body.currency !== undefined) updateData.currency = body.currency as string;
  if (body.photo !== undefined) updateData.imageUrl = (body.photo as string) ?? null;
  if (body.category !== undefined) updateData.category = (body.category as string) ?? null;
  if (body.unit !== undefined) updateData.unit = (body.unit as string) ?? null;
  if (body.stockQty !== undefined) updateData.stockQty = (body.stockQty as number | null) ?? null;
  if (body.showStock !== undefined) updateData.showStock = body.showStock as boolean;
  if (body.duration !== undefined) updateData.durationMinutes = (body.duration as number) ?? null;
  if (body.billingType !== undefined) updateData.billingType = body.billingType as "fixed" | "hourly";
  if (body.allowsBooking !== undefined) updateData.allowsBooking = body.allowsBooking as boolean;
  if (body.isAvailable !== undefined) updateData.isAvailable = body.isAvailable as boolean;
  const [updated] = await db.update(servicesTable).set(updateData)
    .where(and(eq(servicesTable.id, itemId), eq(servicesTable.businessId, bizId))).returning();
  if (!updated) { res.status(404).json({ error: "Élément introuvable" }); return; }
  res.json(toApiItem(updated));
});

router.delete("/businesses/:bizId/catalog/:itemId", requireAuth, async (req: AuthRequest, res) => {
  const bizId = req.params.bizId as string;
  const itemId = req.params.itemId as string;
  const [biz] = await db.select({ ownerId: businessesTable.ownerId }).from(businessesTable)
    .where(eq(businessesTable.id, bizId)).limit(1);
  if (!biz || biz.ownerId !== req.userId) { res.status(403).json({ error: "Accès refusé" }); return; }
  await db.delete(servicesTable)
    .where(and(eq(servicesTable.id, itemId), eq(servicesTable.businessId, bizId)));
  res.status(204).send();
});

// ─── Horaires (pro) ──────────────────────────────────────────────────────────

router.get("/businesses/:id/hours", requireAuth, async (req: AuthRequest, res) => {
  const id = req.params.id as string;
  const [biz] = await db.select({ ownerId: businessesTable.ownerId }).from(businessesTable)
    .where(eq(businessesTable.id, id)).limit(1);
  if (!biz) { res.status(404).json({ error: "Business introuvable" }); return; }
  if (biz.ownerId !== req.userId) { res.status(403).json({ error: "Accès refusé" }); return; }
  const hours = await db.select().from(businessHoursTable).where(eq(businessHoursTable.businessId, id));
  res.json(hours);
});

router.put("/businesses/:id/hours", requireAuth, async (req: AuthRequest, res) => {
  const id = req.params.id as string;
  const [biz] = await db.select({ ownerId: businessesTable.ownerId }).from(businessesTable)
    .where(eq(businessesTable.id, id)).limit(1);
  if (!biz) { res.status(404).json({ error: "Business introuvable" }); return; }
  if (biz.ownerId !== req.userId) { res.status(403).json({ error: "Accès refusé" }); return; }
  const entries = req.body as Array<{ day: string; openTime: string; closeTime: string; isClosed: boolean }>;
  if (!Array.isArray(entries)) { res.status(400).json({ error: "body doit être un tableau" }); return; }
  await db.delete(businessHoursTable).where(eq(businessHoursTable.businessId, id));
  if (entries.length > 0) {
    await db.insert(businessHoursTable).values(
      entries.map((e) => ({
        businessId: id,
        dayOfWeek: e.day as typeof businessHoursTable.$inferInsert["dayOfWeek"],
        openTime: e.openTime,
        closeTime: e.closeTime,
        isClosed: e.isClosed,
      }))
    );
  }
  const updated = await db.select().from(businessHoursTable).where(eq(businessHoursTable.businessId, id));
  res.json(updated);
});

// ─── Stats dashboard (pro) ───────────────────────────────────────────────────

router.get("/businesses/:id/stats", requireAuth, async (req: AuthRequest, res) => {
  const id = req.params.id as string;
  const [biz] = await db.select({ ownerId: businessesTable.ownerId }).from(businessesTable)
    .where(eq(businessesTable.id, id)).limit(1);
  if (!biz) { res.status(404).json({ error: "Business introuvable" }); return; }
  if (biz.ownerId !== req.userId) { res.status(403).json({ error: "Accès refusé" }); return; }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [[bookingTotal], [bookingMonth], [orderTotal], [orderMonth], [revenueMonth]] = await Promise.all([
    db.select({ c: count() }).from(bookingsTable).where(eq(bookingsTable.businessId, id)),
    db.select({ c: count() }).from(bookingsTable).where(
      and(eq(bookingsTable.businessId, id), sql`${bookingsTable.createdAt} >= ${monthStart}`)
    ),
    db.select({ c: count() }).from(ordersTable).where(eq(ordersTable.businessId, id)),
    db.select({ c: count() }).from(ordersTable).where(
      and(eq(ordersTable.businessId, id), sql`${ordersTable.createdAt} >= ${monthStart}`)
    ),
    db.select({ s: sum(ordersTable.total) }).from(ordersTable).where(
      and(
        eq(ordersTable.businessId, id),
        sql`${ordersTable.createdAt} >= ${monthStart}`,
        sql`${ordersTable.status} != 'cancelled'`
      )
    ),
  ]);

  res.json({
    bookingsTotal: bookingTotal?.c ?? 0,
    bookingsThisMonth: bookingMonth?.c ?? 0,
    ordersTotal: orderTotal?.c ?? 0,
    ordersThisMonth: orderMonth?.c ?? 0,
    revenueThisMonth: Number(revenueMonth?.s ?? 0),
  });
});

// ─── Commandes pro (reçues par le business) ──────────────────────────────────

router.get("/businesses/:id/orders", requireAuth, async (req: AuthRequest, res) => {
  const id = req.params.id as string;
  const [biz] = await db.select({ ownerId: businessesTable.ownerId }).from(businessesTable)
    .where(eq(businessesTable.id, id)).limit(1);
  if (!biz) { res.status(404).json({ error: "Business introuvable" }); return; }
  if (biz.ownerId !== req.userId) { res.status(403).json({ error: "Accès refusé" }); return; }

  const orders = await db.select().from(ordersTable)
    .where(eq(ordersTable.businessId, id))
    .orderBy(sql`${ordersTable.createdAt} DESC`);

  const ordersWithItems = await Promise.all(
    orders.map(async (order) => {
      const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
      return { ...order, items };
    })
  );
  res.json(ordersWithItems);
});

export default router;
