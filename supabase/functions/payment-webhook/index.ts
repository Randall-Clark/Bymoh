// ============================================================
// Edge Function : payment-webhook  (v2 — gateway-agnostic)
// Pour ajouter PawaPay : compléter _pawapay.ts et ajouter
// la détection du gateway dans detectGateway()
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  parseWebhookBody as paydunyaParse,
  verifyHash       as paydunyaVerify,
  confirmPayment   as paydunyaConfirm,
} from './_paydunya.ts';

// Détecte quel gateway a envoyé le webhook
// PawaPay utilise le header X-PawaPay-Signature
function detectGateway(req: Request): 'paydunya' | 'pawapay' {
  if (req.headers.get('x-pawapay-signature')) return 'pawapay';
  return 'paydunya';
}

// ── Handler principal ────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Toujours répondre 200 à PayDunya/PawaPay pour éviter les retries infinis
  const ok = () => new Response('OK', { status: 200 });

  try {
    const gateway = detectGateway(req);

    // ── 1. Parser le body selon le gateway ───────────────────
    const parsed = gateway === 'paydunya'
      ? await paydunyaParse(req)
      : null; // pawapayParse(req) quand implémenté

    if (!parsed) {
      console.error('Webhook body invalide ou gateway non supporté');
      return ok();
    }

    // ── 2. Vérifier l'authenticité ────────────────────────────
    if (parsed.received_hash) {
      const valid = gateway === 'paydunya'
        ? await paydunyaVerify(parsed.received_hash)
        : false;

      if (!valid) {
        console.error('Hash webhook invalide — requête ignorée');
        return ok();
      }
    }

    // ── 3. Confirmer le statut auprès du gateway ──────────────
    const confirmed = gateway === 'paydunya'
      ? await paydunyaConfirm(parsed.gateway_token)
      : null;

    if (!confirmed) {
      console.error('Confirmation gateway échouée pour token:', parsed.gateway_token);
      return ok();
    }

    // ── 4. Récupérer la transaction en base ───────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: transaction, error: txError } = await supabase
      .from('payment_transactions')
      .select('id, order_id, booking_id, business_id, amount, status')
      .eq('paydunya_token', confirmed.gateway_token)
      .single();

    if (txError || !transaction) {
      console.error('Transaction introuvable pour token:', confirmed.gateway_token);
      return ok();
    }

    // Anti double-traitement
    if (transaction.status === 'completed' || transaction.status === 'failed') {
      console.log('Transaction déjà traitée:', transaction.id);
      return ok();
    }

    // ── 5. Mettre à jour payment_transactions ─────────────────
    // settled_at n'est PAS fixé ici — il sera fixé par confirm-delivery
    // quand le client confirme la réception (+24h)
    await supabase
      .from('payment_transactions')
      .update({
        status:   confirmed.status,
        metadata: { gateway, raw: parsed.raw, confirmed },
      })
      .eq('id', transaction.id);

    // ── 6. Mettre à jour order / booking ─────────────────────
    const paymentStatus = confirmed.status === 'completed' ? 'paid' : 'unpaid';

    if (transaction.order_id) {
      await supabase.from('orders')
        .update({ payment_status: paymentStatus })
        .eq('id', transaction.order_id);
    }
    if (transaction.booking_id) {
      await supabase.from('bookings')
        .update({ payment_status: paymentStatus })
        .eq('id', transaction.booking_id);
    }

    // ── 7. Créditer le wallet (si completed) ─────────────────
    if (confirmed.status === 'completed') {
      const amount = confirmed.confirmed_amount > 0
        ? confirmed.confirmed_amount
        : transaction.amount;

      const { data: wallet } = await supabase
        .from('wallet_accounts')
        .select('id, pending_balance, available_balance, total_earned, balance')
        .eq('business_id', transaction.business_id)
        .single();

      if (wallet) {
        await supabase
          .from('wallet_accounts')
          .update({
            pending_balance: (wallet.pending_balance ?? 0) + amount,
            total_earned:    (wallet.total_earned    ?? 0) + amount,
            balance:         (wallet.balance         ?? 0) + amount,
          })
          .eq('id', wallet.id);
      } else {
        await supabase.from('wallet_accounts').insert({
          business_id:       transaction.business_id,
          pending_balance:   amount,
          available_balance: 0,
          total_earned:      amount,
          balance:           amount,
        });
      }

      console.log(`✅ ${gateway} — paiement complété — ${amount} XOF → marchand ${transaction.business_id}`);
    } else {
      console.log(`❌ ${gateway} — paiement ${confirmed.status} — transaction ${transaction.id}`);
    }

    return ok();

  } catch (err) {
    console.error('payment-webhook erreur:', err);
    return ok();
  }
});
