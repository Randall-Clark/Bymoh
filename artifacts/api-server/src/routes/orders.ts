import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, businessesTable, notificationsTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router = Router();

router.get("/orders", requireAuth, async (req: AuthRequest, res) => {
  const orders = await db
    .select({
      order: ordersTable,
      businessName: businessesTable.name,
      businessCategory: businessesTable.category,
    })
    .from(ordersTable)
    .leftJoin(businessesTable, eq(ordersTable.businessId, businessesTable.id))
    .where(eq(ordersTable.userId, req.userId!))
    .orderBy(ordersTable.createdAt);
  res.json(orders);
});

router.get("/orders/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = req.params.id as string;
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "Commande introuvable" }); return; }
  if (order.userId !== req.userId) { res.status(403).json({ error: "Accès refusé" }); return; }
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));
  res.json({ ...order, items });
});

router.post("/orders", requireAuth, async (req: AuthRequest, res) => {
  const { businessId, deliveryMethod, deliveryAddress, items, notes } = req.body as {
    businessId?: string;
    deliveryMethod?: "delivery" | "pickup";
    deliveryAddress?: string;
    items?: Array<{ serviceId?: string; title: string; quantity: number; unitPrice: number; currency?: string }>;
    notes?: string;
  };
  if (!businessId || !items?.length) {
    res.status(400).json({ error: "businessId et items requis" }); return;
  }
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const deliveryFee = deliveryMethod === "delivery" ? 1500 : 0;
  const total = subtotal + deliveryFee;

  const [order] = await db.insert(ordersTable).values({
    userId: req.userId!,
    businessId,
    deliveryMethod: deliveryMethod ?? "pickup",
    deliveryAddress: deliveryAddress ?? null,
    deliveryFee,
    subtotal,
    total,
    notes: notes ?? null,
    status: "pending",
  }).returning();

  await db.insert(orderItemsTable).values(
    items.map((i) => ({
      orderId: order.id,
      serviceId: i.serviceId ?? null,
      title: i.title,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      currency: i.currency ?? "FCFA",
    })),
  );

  const [biz] = await db
    .select({ ownerId: businessesTable.ownerId, name: businessesTable.name })
    .from(businessesTable)
    .where(eq(businessesTable.id, businessId))
    .limit(1);
  if (biz) {
    await db.insert(notificationsTable).values({
      userId: biz.ownerId,
      title: "Nouvelle commande",
      body: `Vous avez reçu une commande de ${total.toLocaleString("fr-FR")} FCFA`,
      type: "order",
      relatedId: order.id,
    });
  }

  res.status(201).json(order);
});

router.patch("/orders/:id/status", requireAuth, async (req: AuthRequest, res) => {
  const id = req.params.id as string;
  const { status } = req.body as { status?: string };
  if (!status) { res.status(400).json({ error: "status requis" }); return; }
  const [order] = await db.select({ userId: ordersTable.userId }).from(ordersTable)
    .where(eq(ordersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "Commande introuvable" }); return; }
  const [updated] = await db.update(ordersTable)
    .set({ status: status as typeof ordersTable.$inferInsert.status, updatedAt: new Date() })
    .where(eq(ordersTable.id, id)).returning();
  res.json(updated);
});

export default router;
