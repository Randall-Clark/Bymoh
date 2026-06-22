import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db, bookingsTable, businessesTable, servicesTable, usersTable, notificationsTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router = Router();

router.get("/bookings", requireAuth, async (req: AuthRequest, res) => {
  const rows = await db
    .select({
      booking: bookingsTable,
      businessName: businessesTable.name,
      businessCategory: businessesTable.category,
      serviceTitle: servicesTable.title,
      servicePrice: servicesTable.price,
    })
    .from(bookingsTable)
    .leftJoin(businessesTable, eq(bookingsTable.businessId, businessesTable.id))
    .leftJoin(servicesTable, eq(bookingsTable.serviceId, servicesTable.id))
    .where(eq(bookingsTable.userId, req.userId!))
    .orderBy(bookingsTable.createdAt);
  res.json(rows);
});

router.post("/bookings", requireAuth, async (req: AuthRequest, res) => {
  const { businessId, serviceId, bookingType, date, time, partySize, notes } = req.body as {
    businessId?: string; serviceId?: string; bookingType?: "table" | "service";
    date?: string; time?: string; partySize?: number; notes?: string;
  };
  if (!businessId || !bookingType || !date || !time) {
    res.status(400).json({ error: "businessId, bookingType, date, time sont requis" }); return;
  }
  if (bookingType === "table" && !partySize) {
    res.status(400).json({ error: "partySize requis pour une réservation de table" }); return;
  }
  if (bookingType === "service" && !serviceId) {
    res.status(400).json({ error: "serviceId requis pour une réservation de service" }); return;
  }
  const [booking] = await db.insert(bookingsTable).values({
    userId: req.userId!,
    businessId,
    serviceId: serviceId ?? null,
    bookingType,
    date,
    time,
    partySize: partySize ?? null,
    notes: notes ?? null,
    status: "pending",
  }).returning();

  const [biz] = await db
    .select({ ownerId: businessesTable.ownerId })
    .from(businessesTable)
    .where(eq(businessesTable.id, businessId))
    .limit(1);
  if (biz) {
    const typeLabel = bookingType === "table" ? "table" : "service";
    await db.insert(notificationsTable).values({
      userId: biz.ownerId,
      title: "Nouvelle réservation",
      body: `Réservation ${typeLabel} le ${date} à ${time}`,
      type: "booking",
      relatedId: booking.id,
    });
  }

  res.status(201).json(booking);
});

router.patch("/bookings/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = req.params.id as string;
  const { status, notes } = req.body as { status?: string; notes?: string };
  const [bk] = await db.select({ userId: bookingsTable.userId }).from(bookingsTable).where(eq(bookingsTable.id, id)).limit(1);
  if (!bk) { res.status(404).json({ error: "Réservation introuvable" }); return; }
  if (bk.userId !== req.userId) { res.status(403).json({ error: "Accès refusé" }); return; }
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (status) updates.status = status;
  if (notes !== undefined) updates.notes = notes;
  const [updated] = await db.update(bookingsTable).set(updates).where(eq(bookingsTable.id, id)).returning();
  res.json(updated);
});

router.get("/bookings/pro", requireAuth, async (req: AuthRequest, res) => {
  const [biz] = await db.select({ id: businessesTable.id }).from(businessesTable).where(eq(businessesTable.ownerId, req.userId!)).limit(1);
  if (!biz) { res.status(404).json({ error: "Aucun business trouvé pour ce compte" }); return; }
  const rows = await db
    .select({
      booking: bookingsTable,
      userName: usersTable.name,
      userPhone: usersTable.phone,
      serviceTitle: servicesTable.title,
    })
    .from(bookingsTable)
    .leftJoin(usersTable, eq(bookingsTable.userId, usersTable.id))
    .leftJoin(servicesTable, eq(bookingsTable.serviceId, servicesTable.id))
    .where(eq(bookingsTable.businessId, biz.id))
    .orderBy(bookingsTable.date);
  res.json(rows.map((r) => ({
    id: r.booking.id,
    date: r.booking.date,
    time: r.booking.time,
    status: r.booking.status,
    bookingType: r.booking.bookingType,
    partySize: r.booking.partySize,
    notes: r.booking.notes,
    createdAt: r.booking.createdAt,
    serviceTitle: r.serviceTitle ?? null,
    userName: r.userName ?? null,
    userPhone: r.userPhone ?? null,
  })));
});

router.patch("/bookings/pro/:id/status", requireAuth, async (req: AuthRequest, res) => {
  const id = req.params.id as string;
  const { status } = req.body as { status?: string };
  if (!status) { res.status(400).json({ error: "status requis" }); return; }

  const [biz] = await db.select({ id: businessesTable.id }).from(businessesTable)
    .where(eq(businessesTable.ownerId, req.userId!)).limit(1);
  if (!biz) { res.status(404).json({ error: "Aucun business trouvé pour ce compte" }); return; }

  const [booking] = await db.select({ businessId: bookingsTable.businessId }).from(bookingsTable)
    .where(eq(bookingsTable.id, id)).limit(1);
  if (!booking) { res.status(404).json({ error: "Réservation introuvable" }); return; }
  if (booking.businessId !== biz.id) { res.status(403).json({ error: "Accès refusé" }); return; }

  const [updated] = await db.update(bookingsTable)
    .set({ status: status as typeof bookingsTable.$inferInsert.status, updatedAt: new Date() })
    .where(eq(bookingsTable.id, id)).returning();
  res.json(updated);
});

export default router;
