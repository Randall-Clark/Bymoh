import { Router } from "express";
import { and, eq, ilike, or } from "drizzle-orm";
import { db, businessesTable, businessHoursTable, servicesTable } from "@workspace/db";
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

export default router;
