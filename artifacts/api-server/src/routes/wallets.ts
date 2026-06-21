import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db, walletsTable, walletTransactionsTable, businessesTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router = Router();

async function getOrCreateWallet(
  userId: string,
  type: "personal" | "business",
  businessId?: string,
) {
  const conditions = [
    eq(walletsTable.userId, userId),
    eq(walletsTable.type, type),
    ...(businessId ? [eq(walletsTable.businessId, businessId)] : []),
  ];
  const [existing] = await db
    .select()
    .from(walletsTable)
    .where(and(...conditions))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(walletsTable)
    .values({ userId, type, businessId: businessId ?? null, balance: 0 })
    .returning();
  return created;
}

function computePending(txs: { type: string; amount: number }[]): number {
  return txs.filter((t) => t.type === "pending").reduce((s, t) => s + t.amount, 0);
}

// ── Personal wallet ──────────────────────────────────────────────────────────

router.get("/wallets/personal", requireAuth, async (req: AuthRequest, res) => {
  const wallet = await getOrCreateWallet(req.userId!, "personal");
  const transactions = await db
    .select()
    .from(walletTransactionsTable)
    .where(eq(walletTransactionsTable.walletId, wallet.id))
    .orderBy(walletTransactionsTable.createdAt);
  const pendingBalance = computePending(transactions);
  res.json({ ...wallet, pendingBalance, transactions });
});

router.post("/wallets/personal/topup", requireAuth, async (req: AuthRequest, res) => {
  const { amount } = req.body as { amount?: number };
  if (!amount || amount < 100) {
    res.status(400).json({ error: "Montant minimum : 100 FCFA" });
    return;
  }
  const wallet = await getOrCreateWallet(req.userId!, "personal");
  await db.insert(walletTransactionsTable).values({
    walletId: wallet.id,
    type: "pending",
    label: "Recharge Mobile Money",
    sublabel: "En cours de traitement",
    amount,
  });
  await db
    .update(walletsTable)
    .set({ balance: wallet.balance + amount, updatedAt: new Date() })
    .where(eq(walletsTable.id, wallet.id));
  const updated = await db.select().from(walletsTable).where(eq(walletsTable.id, wallet.id)).limit(1);
  res.json(updated[0]);
});

// ── Business wallet ──────────────────────────────────────────────────────────

router.get("/wallets/business/:businessId", requireAuth, async (req: AuthRequest, res) => {
  const businessId = req.params.businessId as string;
  const [biz] = await db.select().from(businessesTable).where(eq(businessesTable.id, businessId)).limit(1);
  if (!biz || biz.ownerId !== req.userId) {
    res.status(403).json({ error: "Accès refusé" });
    return;
  }
  const wallet = await getOrCreateWallet(req.userId!, "business", businessId);
  const transactions = await db
    .select()
    .from(walletTransactionsTable)
    .where(eq(walletTransactionsTable.walletId, wallet.id))
    .orderBy(walletTransactionsTable.createdAt);
  const pendingBalance = computePending(transactions);
  res.json({ ...wallet, pendingBalance, transactions });
});

router.post("/wallets/business/:businessId/withdraw", requireAuth, async (req: AuthRequest, res) => {
  const businessId = req.params.businessId as string;
  const { amount } = req.body as { amount?: number };
  if (!amount || amount < 500) {
    res.status(400).json({ error: "Montant minimum de retrait : 500 FCFA" });
    return;
  }
  const [biz] = await db.select().from(businessesTable).where(eq(businessesTable.id, businessId)).limit(1);
  if (!biz || biz.ownerId !== req.userId) {
    res.status(403).json({ error: "Accès refusé" });
    return;
  }
  const wallet = await getOrCreateWallet(req.userId!, "business", businessId);
  if (wallet.balance < amount) {
    res.status(400).json({ error: "Solde insuffisant" });
    return;
  }
  await db.insert(walletTransactionsTable).values({
    walletId: wallet.id,
    type: "debit",
    label: "Retrait Mobile Money",
    sublabel: "En cours de traitement",
    amount,
  });
  await db
    .update(walletsTable)
    .set({ balance: wallet.balance - amount, updatedAt: new Date() })
    .where(eq(walletsTable.id, wallet.id));
  const [updated] = await db.select().from(walletsTable).where(eq(walletsTable.id, wallet.id)).limit(1);
  res.json(updated);
});

export default router;
