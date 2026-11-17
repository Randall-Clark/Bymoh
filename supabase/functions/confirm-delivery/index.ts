// ============================================================
// Edge Function : confirm-delivery
// Rôle : Appelée quand le client confirme la réception de sa
//        commande ou la réalisation de son service.
//        → marque l'order/booking comme livré
//        → déclenche le compte à rebours de 24h avant que
//          le marchand puisse retirer ses fonds
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 1. Auth ───────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonError('Non autorisé', 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: { user }, error: authError } = await createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    ).auth.getUser();

    if (authError || !user) return jsonError('Non autorisé', 401);

    // ── 2. Body ───────────────────────────────────────────────
    const body = await req.json();
    const { order_id, booking_id } = body;

    if (!order_id && !booking_id) {
      return jsonError('order_id ou booking_id requis');
    }

    const now             = new Date();
    const settledAt       = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24h
    const confirmedAt     = now.toISOString();
    const settledAtIso    = settledAt.toISOString();

    // ── 3. Vérifier que c'est bien le client qui confirme ─────
    let transactionId: string | null = null;
    let businessId:    string | null = null;

    if (order_id) {
      const { data: order, error } = await supabase
        .from('orders')
        .select('id, customer_id, business_id, payment_status, delivery_confirmed_at, payment_transaction_id')
        .eq('id', order_id)
        .single();

      if (error || !order)                           return jsonError('Commande introuvable', 404);
      if (order.customer_id !== user.id)             return jsonError('Accès refusé', 403);
      if (order.payment_status !== 'paid')           return jsonError('Cette commande n\'a pas encore été payée', 400);
      if (order.delivery_confirmed_at)               return jsonError('Livraison déjà confirmée', 409);

      // Marquer la commande comme livrée
      await supabase
        .from('orders')
        .update({ delivery_confirmed_at: confirmedAt, delivery_status: 'delivered' })
        .eq('id', order_id);

      transactionId = order.payment_transaction_id;
      businessId    = order.business_id;

    } else {
      const { data: booking, error } = await supabase
        .from('bookings')
        .select('id, customer_id, business_id, payment_status, delivery_confirmed_at, payment_transaction_id')
        .eq('id', booking_id)
        .single();

      if (error || !booking)                          return jsonError('Réservation introuvable', 404);
      if (booking.customer_id !== user.id)            return jsonError('Accès refusé', 403);
      if (booking.payment_status !== 'paid')          return jsonError('Cette réservation n\'a pas encore été payée', 400);
      if (booking.delivery_confirmed_at)              return jsonError('Service déjà confirmé', 409);

      // Marquer la réservation comme service rendu
      await supabase
        .from('bookings')
        .update({ delivery_confirmed_at: confirmedAt, delivery_status: 'delivered' })
        .eq('id', booking_id);

      transactionId = booking.payment_transaction_id;
      businessId    = booking.business_id;
    }

    // ── 4. Déclencher le compte à rebours de 24h ─────────────
    // On set settled_at = now() + 24h sur la transaction
    // Le cron settle-pending-balances fera le reste demain matin
    if (transactionId) {
      await supabase
        .from('payment_transactions')
        .update({ settled_at: settledAtIso })
        .eq('id', transactionId)
        .eq('status', 'completed')
        .eq('balance_settled', false);
    } else {
      // Pas de transaction liée directement — chercher via business_id + order/booking
      await supabase
        .from('payment_transactions')
        .update({ settled_at: settledAtIso })
        .eq('business_id', businessId!)
        .eq(order_id ? 'order_id' : 'booking_id', order_id ?? booking_id)
        .eq('status', 'completed')
        .eq('balance_settled', false);
    }

    console.log(`✅ Livraison confirmée — settled_at fixé à ${settledAtIso} (dans 24h)`);

    return jsonOk({
      message:    'Livraison confirmée. Les fonds seront disponibles pour le marchand dans 24h.',
      settled_at: settledAtIso,
    });

  } catch (err) {
    console.error('confirm-delivery error:', err);
    return jsonError('Erreur interne du serveur', 500);
  }
});

function jsonOk(data: Record<string, unknown>) {
  return new Response(JSON.stringify({ success: true, ...data }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
