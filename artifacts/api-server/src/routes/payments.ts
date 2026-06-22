import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, walletsTable, walletTransactionsTable } from "@workspace/db";

const router = Router();

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
