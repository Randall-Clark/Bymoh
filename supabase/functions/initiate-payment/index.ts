// ============================================================
// Edge Function : initiate-payment  (v2 — gateway-agnostic)
// Pour passer de PayDunya à PawaPay :
//   1. Compléter _pawapay.ts
//   2. Ajouter les méthodes PawaPay dans PAWAPAY_METHODS
//   3. Ajouter les secrets PAWAPAY_* dans Supabase
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { initiatePayment as paydunyaInitiate, REDIRECT_METHODS } from './_paydunya.ts';
// import { initiatePayment as pawapayInitiate } from './_pawapay.ts'; // décommenter plus tard

// Méthodes qui passeront par PawaPay quand actif
// Pour l'instant tout passe par PayDunya
const PAWAPAY_METHODS = new Set<string>([
  // 'mtn-ci', 'wave-senegal', etc. — à remplir quand PawaPay sera actif
]);

function selectGateway(method: string) {
  if (PAWAPAY_METHODS.has(method)) {
    // return pawapayInitiate; // décommenter quand PawaPay prêt
  }
  return paydunyaInitiate;
}

// ── Handler principal ────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    });
  }

  try {
    // ── 1. Auth ───────────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonError('Non autorisé', 401);

    const { data: { user }, error: authError } = await createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    ).auth.getUser();

    if (authError || !user) return jsonError('Non autorisé', 401);

    // ── 2. Validation body ────────────────────────────────────
    const body = await req.json();
    const { order_id, booking_id, payment_method, customer_name, customer_email, customer_phone, country } = body;

    if (!order_id && !booking_id)   return jsonError('order_id ou booking_id requis');
    if (!payment_method)            return jsonError('payment_method requis');
    if (!customer_name)             return jsonError('customer_name requis');
    if (!customer_email)            return jsonError('customer_email requis');
    if (!customer_phone)            return jsonError('customer_phone requis');

    // ── 3. Récupérer la commande / réservation ────────────────
    let amount     = 0;
    let businessId = '';

    if (order_id) {
      const { data: order, error } = await supabase
        .from('orders')
        .select('id, total_amount, business_id, payment_status')
        .eq('id', order_id)
        .single();

      if (error || !order)                    return jsonError('Commande introuvable', 404);
      if (order.payment_status === 'paid')    return jsonError('Commande déjà payée', 400);
      if (order.payment_status === 'pending') return jsonError('Un paiement est déjà en cours pour cette commande', 409);

      amount     = order.total_amount;
      businessId = order.business_id;

    } else {
      const { data: booking, error } = await supabase
        .from('bookings')
        .select('id, total_amount, business_id, payment_status')
        .eq('id', booking_id)
        .single();

      if (error || !booking)                    return jsonError('Réservation introuvable', 404);
      if (booking.payment_status === 'paid')    return jsonError('Réservation déjà payée', 400);
      if (booking.payment_status === 'pending') return jsonError('Un paiement est déjà en cours pour cette réservation', 409);

      amount     = booking.total_amount;
      businessId = booking.business_id;
    }

    if (!amount || amount <= 0) return jsonError('Montant invalide');

    // ── 4. Vérifier la boutique ───────────────────────────────
    const { data: business } = await supabase
      .from('businesses')
      .select('name, status')
      .eq('id', businessId)
      .single();

    if (!business)                          return jsonError('Boutique introuvable', 404);
    if (business.status === 'suspended')    return jsonError('Cette boutique est suspendue', 403);

    // ── 5. Choisir le gateway et initier le paiement ──────────
    const gatewayFn = selectGateway(payment_method);
    const gatewayResult = await gatewayFn({
      amount,
      payment_method,
      customer_name,
      customer_email,
      customer_phone,
      order_id:      order_id   ?? null,
      booking_id:    booking_id ?? null,
      business_id:   businessId,
      business_name: business.name,
      user_id:       user.id,
      callback_url:  `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-webhook`,
    });

    // ── 6. Enregistrer la transaction ─────────────────────────
    const { data: transaction, error: txError } = await supabase
      .from('payment_transactions')
      .insert({
        order_id:       order_id   ?? null,
        booking_id:     booking_id ?? null,
        business_id:    businessId,
        amount,
        currency:       gatewayResult.currency,
        paydunya_token: gatewayResult.gateway_token,  // colonne générique — renommer en gateway_token à terme
        payment_method,
        country:        country ?? null,
        status:         'pending',
        customer_name,
        customer_email,
        customer_phone,
        metadata: {
          gateway:      PAWAPAY_METHODS.has(payment_method) ? 'pawapay' : 'paydunya',
          redirect_url: gatewayResult.redirect_url ?? null,
        },
      })
      .select('id')
      .single();

    if (txError) {
      console.error('DB insert error:', txError);
      return jsonError('Erreur lors de l\'enregistrement de la transaction', 500);
    }

    // ── 7. Marquer order/booking comme pending ────────────────
    const updatePayload = { payment_status: 'pending', payment_transaction_id: transaction.id };
    if (order_id)   await supabase.from('orders').update(updatePayload).eq('id', order_id);
    if (booking_id) await supabase.from('bookings').update(updatePayload).eq('id', booking_id);

    // ── 8. Réponse ────────────────────────────────────────────
    return jsonOk({
      transaction_id: transaction.id,
      type:           gatewayResult.type,
      token:          gatewayResult.gateway_token,
      message:        gatewayResult.message,
      ...(gatewayResult.redirect_url ? { redirect_url: gatewayResult.redirect_url } : {}),
      ...(gatewayResult.fees         ? { fees: gatewayResult.fees }                 : {}),
      currency:       gatewayResult.currency,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('initiate-payment error:', msg);

    // Erreur gateway connue → la remonter proprement
    if (msg.startsWith('PayDunya') || msg.startsWith('PawaPay')) {
      return jsonError(msg, 502);
    }
    return jsonError('Erreur interne du serveur', 500);
  }
});

// ── Helpers ──────────────────────────────────────────────────

function jsonOk(data: Record<string, unknown>) {
  return new Response(JSON.stringify({ success: true, ...data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return new Response(JSON.stringify({ success: false, error: message, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
