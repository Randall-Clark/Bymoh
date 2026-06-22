import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, walletsTable, walletTransactionsTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../lib/auth";

const router = Router();

const CINETPAY_API_KEY = process.env.CINETPAY_API_KEY;
const CINETPAY_SITE_ID = process.env.CINETPAY_SITE_ID;
const CINETPAY_BASE = "https://api-checkout.cinetpay.com/v2";

const METHOD_CHANNEL: Record<string, string> = {
  moov_money: "MOBILE_MONEY",
  mtn_momo: "MOBILE_MONEY",
  card: "CREDIT_CARD",
};

const METHOD_LABEL: Record<string, string> = {
  moov_money: "Moov Money",
  mtn_momo: "MTN MoMo",
  card: "Carte bancaire",
};

const REGISTRATION_FEE = 10_000;

/**
 * Initiate a business registration payment (10 000 FCFA one-time fee).
 * Sandbox mode when CinetPay credentials are absent.
 */
router.post("/payments/registration/initiate", requireAuth, async (req: AuthRequest, res) => {
  const { method, phone } = req.body as { method?: string; phone?: string };

  if (!method || !METHOD_LABEL[method]) {
    res.status(400).json({ error: "Méthode de paiement invalide" });
    return;
  }

  const transactionId = `KOLA-REG-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  // ── Sandbox ───────────────────────────────────────────────────────────────
  if (!CINETPAY_API_KEY || !CINETPAY_SITE_ID) {
    res.json({ transactionId, paymentUrl: null, sandbox: true });
    return;
  }

  // ── CinetPay ──────────────────────────────────────────────────────────────
  const domain =
    (process.env.REPLIT_DOMAINS ?? "").split(",")[0]?.trim() ||
    `localhost:${process.env.PORT ?? 5000}`;
  const protocol = domain.startsWith("localhost") ? "http" : "https";

  const payload = {
    apikey: CINETPAY_API_KEY,
    site_id: CINETPAY_SITE_ID,
    transaction_id: transactionId,
    amount: REGISTRATION_FEE,
    currency: "XOF",
    description: "Inscription Kola Pro — Frais d'activation (paiement unique)",
    notify_url: `${protocol}://${domain}/api/payments/webhook/cinetpay`,
    return_url: `${protocol}://${domain}/api/payments/return`,
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

  res.json({ transactionId, paymentUrl: cpJson.data.payment_url, sandbox: false });
});

/**
 * CinetPay webhook — called by CinetPay when a payment completes.
 * cpm_result === "00" means success.
 * We look up the pending transaction by paymentRef and credit the wallet.
 */
router.post("/payments/webhook/cinetpay", async (req, res) => {
  try {
    const body = req.body as Record<string, string>;
    const {
      cpm_trans_id,
      cpm_result,
      cpm_amount,
    } = body;

    if (cpm_result !== "00") {
      res.status(200).json({ ok: false, reason: "payment_not_successful" });
      return;
    }

    const amount = parseInt(cpm_amount ?? "0", 10);
    if (!cpm_trans_id || !amount) {
      res.status(400).json({ error: "missing_fields" });
      return;
    }

    // Find pending transaction by paymentRef
    const [pendingTx] = await db
      .select()
      .from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.paymentRef, cpm_trans_id))
      .limit(1);

    if (!pendingTx) {
      res.status(200).json({ ok: false, reason: "transaction_not_found" });
      return;
    }

    // Already processed
    if (pendingTx.type === "credit") {
      res.status(200).json({ ok: true });
      return;
    }

    // Credit the wallet
    const [wallet] = await db
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.id, pendingTx.walletId))
      .limit(1);

    if (!wallet) {
      res.status(200).json({ ok: false, reason: "wallet_not_found" });
      return;
    }

    await db
      .update(walletTransactionsTable)
      .set({ type: "credit", sublabel: "Paiement confirmé" })
      .where(eq(walletTransactionsTable.id, pendingTx.id));

    await db
      .update(walletsTable)
      .set({ balance: wallet.balance + amount, updatedAt: new Date() })
      .where(eq(walletsTable.id, wallet.id));

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;
