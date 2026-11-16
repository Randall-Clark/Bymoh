// ============================================================
// Edge Function : request-payout  (v2 — gateway-agnostic)
// Pour ajouter PawaPay : compléter _pawapay.ts et peupler
// PAWAPAY_METHODS ci-dessous
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requestPayout as paydunyaPayout } from './_paydunya.ts';
// import { requestPayout as pawapayPayout } from './_pawapay.ts'; // décommenter plus tard

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Méthodes qui passeront par PawaPay quand actif
// Pour l'instant tout passe par PayDunya
const PAWAPAY_METHODS = new Set<string>([
  // 'mtn-ci', 'wave-senegal', etc. — à remplir quand PawaPay actif
]);

function selectGateway(method: string) {
  if (PAWAPAY_METHODS.has(method)) {
    // return pawapayPayout; // décommenter quand PawaPay prêt
  }
  return paydunyaPayout;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    // ── 1. Auth ───────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonError('Non autorisé', 401);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (authError || !user) return jsonError('Token invalide', 401);

    // ── 2. Body ───────────────────────────────────────────────
    const { business_id, amount, payment_method, phone_number, full_name } = await req.json();

    if (!business_id || !amount || !payment_method || !phone_number || !full_name) {
      return jsonError('Champs obligatoires manquants: business_id, amount, payment_method, phone_number, full_name');
    }
    if (typeof amount !== 'number' || amount < 100) {
      return jsonError('Montant invalide (minimum 100 XOF)');
    }

    // ── 3. Vérifier propriété de la boutique ──────────────────
    const { data: business } = await supabase
      .from('businesses')
      .select('id, name, status, owner_id')
      .eq('id', business_id)
      .single();

    if (!business)                       return jsonError('Boutique introuvable', 404);
    if (business.owner_id !== user.id)   return jsonError('Accès refusé', 403);
    if (business.status === 'suspended') return jsonError('Boutique suspendue — retraits indisponibles', 403);

    // ── 4. Vérifier le solde disponible ───────────────────────
    const { data: wallet } = await supabase
      .from('wallet_accounts')
      .select('id, available_balance, pending_balance')
      .eq('business_id', business_id)
      .single();

    if (!wallet) return jsonError('Portefeuille introuvable', 404);

    if (wallet.available_balance < amount) {
      return jsonError('Solde insuffisant', 422, {
        available_balance: wallet.available_balance,
        requested: amount,
      });
    }

    // ── 5. Anti-doublon : pas de retrait pending en cours ─────
    const { data: pendingPayout } = await supabase
      .from('merchant_payout_requests')
      .select('id')
      .eq('business_id', business_id)
      .eq('status', 'pending')
      .maybeSingle();

    if (pendingPayout) {
      return jsonError('Un retrait est déjà en cours. Attendez sa finalisation.', 409);
    }

    // ── 6. Choisir le gateway et initier le déboursement ──────
    const gatewayFn = selectGateway(payment_method);
    const gatewayName = PAWAPAY_METHODS.has(payment_method) ? 'pawapay' : 'paydunya';

    const result = await gatewayFn({
      phone_number,
      amount,
      payment_method,
      full_name,
      business_name: business.name,
    });

    // ── 7. Enregistrer dans merchant_payout_requests ──────────
    const { data: payoutRecord } = await supabase
      .from('merchant_payout_requests')
      .insert({
        business_id,
        wallet_account_id:  wallet.id,
        amount,
        payment_method,
        phone_number,
        full_name,
        paydunya_reference: result.gateway_reference,
        status:             'pending',
        raw_response:       { gateway: gatewayName, ...result.raw_response },
      })
      .select('id')
      .single();

    // ── 8. Déduire du solde disponible ────────────────────────
    await supabase
      .from('wallet_accounts')
      .update({
        available_balance: wallet.available_balance - amount,
        updated_at:        new Date().toISOString(),
      })
      .eq('id', wallet.id);

    // ── 9. Réponse ────────────────────────────────────────────
    return jsonOk({
      payout_id:             payoutRecord?.id ?? null,
      gateway_reference:     result.gateway_reference,
      gateway:               gatewayName,
      amount,
      payment_method,
      phone_number,
      message:               'Retrait initié avec succès. Les fonds seront crédités sous peu.',
      new_available_balance: wallet.available_balance - amount,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('request-payout error:', msg);

    if (msg.startsWith('Méthode non supportée') || msg.includes('PayDunya') || msg.includes('PawaPay')) {
      return jsonError(msg, 502);
    }
    return jsonError('Erreur interne du serveur', 500);
  }
});

function jsonOk(data: Record<string, unknown>) {
  return new Response(JSON.stringify({ success: true, ...data }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return new Response(JSON.stringify({ success: false, error: message, ...extra }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
