import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db, walletsTable, walletTransactionsTable, businessesTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../lib/auth";

const CINETPAY_API_KEY = process.env.CINETPAY_API_KEY;
const CINETPAY_SITE_ID = process.env.CINETPAY_SITE_ID;
const CINETPAY_BASE = "https://api-checkout.cinetpay.com/v2";

const METHOD_CHANNEL: Record<string, string> = {
  moov_money: "MOBILE_MONEY",
  mtn_momo:   "MOBILE_MONEY",
  card:        "CREDIT_CARD",
};

const METHOD_LABEL: Record<string, string> = {
  moov_money: "Moov Money",
  mtn_momo:   "MTN MoMo",
  card:        "Carte bancaire",
};

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

router.post("/wallets/personal/topup/initiate", requireAuth, async (req: AuthRequest, res) => {
  const { amount, method, phone } = req.body as {
    amount?: number;
    method?: string;
    phone?: string;
  };
  if (!amount || amount < 100) {
    res.status(400).json({ error: "Montant minimum : 100 FCFA" });
    return;
  }
  if (!method || !METHOD_LABEL[method]) {
    res.status(400).json({ error: "Méthode de paiement invalide" });
    return;
  }

  const wallet = await getOrCreateWallet(req.userId!, "personal");
  const transactionId = `KOLA-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  // ── No CinetPay credentials → sandbox / direct credit ─────────────────────
  if (!CINETPAY_API_KEY || !CINETPAY_SITE_ID) {
    await db.insert(walletTransactionsTable).values({
      walletId: wallet.id,
      type: "credit",
      label: `Recharge ${METHOD_LABEL[method]}`,
      sublabel: "Mode sandbox (paiement simulé)",
      amount,
      paymentRef: transactionId,
    });
    await db
      .update(walletsTable)
      .set({ balance: wallet.balance + amount, updatedAt: new Date() })
      .where(eq(walletsTable.id, wallet.id));
    res.json({ transactionId, paymentUrl: null, sandbox: true });
    return;
  }

  // ── CinetPay payment initiation ────────────────────────────────────────────
  const domain =
    (process.env.REPLIT_DOMAINS ?? "").split(",")[0]?.trim() ||
    `localhost:${process.env.PORT ?? 5000}`;
  const protocol = domain.startsWith("localhost") ? "http" : "https";
  const notifyUrl = `${protocol}://${domain}/api/payments/webhook/cinetpay`;
  const returnUrl = `${protocol}://${domain}/api/payments/return`;

  const payload = {
    apikey: CINETPAY_API_KEY,
    site_id: CINETPAY_SITE_ID,
    transaction_id: transactionId,
    amount,
    currency: "XOF",
    description: `Recharge portefeuille Kola — ${METHOD_LABEL[method]}`,
    notify_url: notifyUrl,
    return_url: returnUrl,
    channels: METHOD_CHANNEL[method] ?? "MOBILE_MONEY",
    lang: "fr",
    ...(phone ? { customer_phone_number: phone } : {}),
  };

  const cpResp = await fetch(`${CINETPAY_BASE}/payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const cpJson = (await cpResp.json()) as {
    code?: string;
    data?: { payment_url?: string };
  };

  if (cpJson.code !== "201" || !cpJson.data?.payment_url) {
    res.status(502).json({ error: "Impossible d'initier le paiement CinetPay" });
    return;
  }

  // Insert pending transaction (wallet credited on webhook confirmation)
  await db.insert(walletTransactionsTable).values({
    walletId: wallet.id,
    type: "pending",
    label: `Recharge ${METHOD_LABEL[method]}`,
    sublabel: "En attente de confirmation",
    amount,
    paymentRef: transactionId,
  });

  res.json({ transactionId, paymentUrl: cpJson.data.payment_url, sandbox: false });
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
