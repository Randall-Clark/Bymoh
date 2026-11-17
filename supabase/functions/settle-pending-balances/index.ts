// ============================================================
// Edge Function : settle-pending-balances
// Rôle : Cron quotidien — déplace pending_balance → available_balance
//        pour toutes les transactions dont settled_at <= now()
// Planification : chaque jour à 09h00 UTC (via GitHub Actions)
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  // Sécurité : accepter uniquement les appels internes (cron secret)
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (cronSecret) {
    const auth = req.headers.get('Authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const now = new Date().toISOString();

    // ── 1. Trouver les transactions prêtes à être settlées ────
    // Conditions : status = 'completed', settled_at <= now, pas encore créditées
    const { data: readyTx, error: fetchError } = await supabase
      .from('payment_transactions')
      .select('id, business_id, amount')
      .eq('status', 'completed')
      .eq('balance_settled', false)   // flag pour éviter les doublons
      .lte('settled_at', now)

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return jsonError(fetchError.message, 500);
    }

    if (!readyTx || readyTx.length === 0) {
      console.log('Aucune transaction à settler.');
      return jsonOk({ settled: 0, message: 'Aucune transaction à settler.' });
    }

    console.log(`${readyTx.length} transaction(s) à settler.`);

    // ── 2. Grouper les montants par business_id ───────────────
    // Optimisation : une seule mise à jour par wallet plutôt qu'une par transaction
    const totals: Record<string, { amount: number; tx_ids: string[] }> = {};
    for (const tx of readyTx) {
      if (!totals[tx.business_id]) {
        totals[tx.business_id] = { amount: 0, tx_ids: [] };
      }
      totals[tx.business_id].amount   += tx.amount;
      totals[tx.business_id].tx_ids.push(tx.id);
    }

    const results: Array<{ business_id: string; amount: number; success: boolean; error?: string }> = [];

    // ── 3. Pour chaque boutique : déplacer pending → available ─
    for (const [business_id, { amount, tx_ids }] of Object.entries(totals)) {
      try {
        const { data: wallet, error: walletError } = await supabase
          .from('wallet_accounts')
          .select('id, pending_balance, available_balance')
          .eq('business_id', business_id)
          .single();

        if (walletError || !wallet) {
          console.error(`Wallet introuvable pour ${business_id}`);
          results.push({ business_id, amount, success: false, error: 'Wallet introuvable' });
          continue;
        }

        // Déplacer pending → available
        const newPending   = Math.max(0, (wallet.pending_balance   ?? 0) - amount);
        const newAvailable = (wallet.available_balance ?? 0) + amount;

        const { error: updateError } = await supabase
          .from('wallet_accounts')
          .update({
            pending_balance:   newPending,
            available_balance: newAvailable,
            updated_at:        now,
          })
          .eq('id', wallet.id);

        if (updateError) {
          console.error(`Wallet update error pour ${business_id}:`, updateError);
          results.push({ business_id, amount, success: false, error: updateError.message });
          continue;
        }

        // Marquer les transactions comme settlées (évite les doublons)
        await supabase
          .from('payment_transactions')
          .update({ balance_settled: true })
          .in('id', tx_ids);

        console.log(`✅ ${business_id} — ${amount} XOF settled (${tx_ids.length} tx)`);
        results.push({ business_id, amount, success: true });

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Erreur pour ${business_id}:`, msg);
        results.push({ business_id, amount, success: false, error: msg });
      }
    }

    const settledCount = results.filter(r => r.success).length;
    const failedCount  = results.filter(r => !r.success).length;

    return jsonOk({
      settled:          settledCount,
      failed:           failedCount,
      total_businesses: results.length,
      results,
    });

  } catch (err) {
    console.error('settle-pending-balances fatal error:', err);
    return jsonError('Erreur interne du serveur', 500);
  }
});

function jsonOk(data: Record<string, unknown>) {
  return new Response(JSON.stringify({ success: true, ...data }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}

function jsonError(message: string, status = 500) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
