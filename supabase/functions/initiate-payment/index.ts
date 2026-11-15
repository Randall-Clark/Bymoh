// ============================================================
// Edge Function : initiate-payment
// Rôle : Crée une facture PayDunya + déclenche le paiement SoftPay
//        Enregistre la transaction dans payment_transactions
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Types ────────────────────────────────────────────────────

interface InitiatePaymentRequest {
  order_id?:       string;
  booking_id?:     string;
  payment_method:  string;  // 'mtn-benin' | 'wave-senegal' | 'orange-money-ci' | 'moov-togo' | 'card' | ...
  country:         string;  // 'BJ' | 'SN' | 'CI' | 'TG'
  customer_name:   string;
  customer_email:  string;
  customer_phone:  string;  // format local (sans +229)
}

interface PayDunyaInvoiceResponse {
  response_code: string;
  response_text: string;
  description:   string;
  token:         string;
}

// ── Config PayDunya ──────────────────────────────────────────

const PAYDUNYA_MODE       = Deno.env.get('PAYDUNYA_MODE') ?? 'sandbox'; // 'sandbox' | 'live'
const PAYDUNYA_BASE       = PAYDUNYA_MODE === 'live'
  ? 'https://app.paydunya.com/api/v1'
  : 'https://app.paydunya.com/sandbox-api/v1';

const PAYDUNYA_HEADERS = {
  'Content-Type':        'application/json',
  'PAYDUNYA-MASTER-KEY': Deno.env.get('PAYDUNYA_MASTER_KEY') ?? '',
  'PAYDUNYA-PRIVATE-KEY':Deno.env.get('PAYDUNYA_PRIVATE_KEY') ?? '',
  'PAYDUNYA-TOKEN':      Deno.env.get('PAYDUNYA_TOKEN') ?? '',
};

// ── Helpers ──────────────────────────────────────────────────

// Construit le body SoftPay selon la méthode choisie
function buildSoftpayBody(
  method: string,
  token: string,
  customerName: string,
  customerEmail: string,
  customerPhone: string,
): Record<string, string> {
  switch (method) {
    case 'mtn-benin':
      return {
        mtn_benin_customer_fullname: customerName,
        mtn_benin_email:             customerEmail,
        mtn_benin_phone_number:      customerPhone,
        mtn_benin_wallet_provider:   'MTNBENIN',
        payment_token:               token,
      };
    case 'moov-benin':
      return {
        moov_benin_customer_fullname: customerName,
        moov_benin_email:             customerEmail,
        moov_benin_phone_number:      customerPhone,
        payment_token:                token,
      };
    case 'wave-senegal':
      return {
        wave_senegal_fullName:        customerName,
        wave_senegal_email:           customerEmail,
        wave_senegal_phone:           customerPhone,
        wave_senegal_payment_token:   token,
      };
    case 'orange-money-senegal':
      return {
        orange_money_senegal_fullname: customerName,
        orange_money_senegal_email:    customerEmail,
        orange_money_senegal_phone:    customerPhone,
        payment_token:                 token,
      };
    case 'free-money-senegal':
      return {
        free_money_senegal_fullname: customerName,
        free_money_senegal_email:    customerEmail,
        free_money_senegal_phone:    customerPhone,
        payment_token:               token,
      };
    case 'mtn-ci':
      return {
        mtn_ci_customer_fullname: customerName,
        mtn_ci_email:             customerEmail,
        mtn_ci_phone_number:      customerPhone,
        payment_token:            token,
      };
    case 'orange-money-ci':
      return {
        orange_money_ci_fullname: customerName,
        orange_money_ci_email:    customerEmail,
        orange_money_ci_phone:    customerPhone,
        payment_token:            token,
      };
    case 'wave-ci':
      return {
        wave_ci_fullName:       customerName,
        wave_ci_email:          customerEmail,
        wave_ci_phone:          customerPhone,
        wave_ci_payment_token:  token,
      };
    case 'moov-ci':
      return {
        moov_ci_customer_fullname: customerName,
        moov_ci_email:             customerEmail,
        moov_ci_phone_number:      customerPhone,
        payment_token:             token,
      };
    case 't-money-togo':
      return {
        t_money_togo_fullname: customerName,
        t_money_togo_email:    customerEmail,
        t_money_togo_phone:    customerPhone,
        payment_token:         token,
      };
    case 'moov-togo':
      return {
        moov_togo_fullname: customerName,
        moov_togo_email:    customerEmail,
        moov_togo_phone:    customerPhone,
        payment_token:      token,
      };
    case 'card':
      // Carte bancaire : nécessite certification PCI-DSS
      // L'app envoie les données carte uniquement si certifiée
      // Sinon on retourne l'URL hosted checkout
      return { payment_token: token };
    default:
      return { payment_token: token };
  }
}

// Méthodes qui retournent une URL de redirection (WebView dans l'app)
const REDIRECT_METHODS = new Set(['wave-senegal', 'wave-ci', 'card']);

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
    // ── 1. Auth Supabase ──────────────────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Vérifier que l'appelant est authentifié
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonError('Non autorisé', 401);
    }
    const { data: { user }, error: authError } = await createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();
    if (authError || !user) {
      return jsonError('Non autorisé', 401);
    }

    // ── 2. Validation du body ─────────────────────────────────
    const body: InitiatePaymentRequest = await req.json();

    if (!body.order_id && !body.booking_id) {
      return jsonError('order_id ou booking_id requis');
    }
    if (!body.payment_method) return jsonError('payment_method requis');
    if (!body.customer_name)  return jsonError('customer_name requis');
    if (!body.customer_email) return jsonError('customer_email requis');
    if (!body.customer_phone) return jsonError('customer_phone requis');

    // ── 3. Récupérer la commande ou réservation ───────────────
    let amount     = 0;
    let businessId = '';
    let itemName   = '';

    if (body.order_id) {
      const { data: order, error } = await supabase
        .from('orders')
        .select('id, total_amount, business_id, payment_status')
        .eq('id', body.order_id)
        .single();

      if (error || !order) return jsonError('Commande introuvable', 404);
      if (order.payment_status === 'paid') return jsonError('Commande déjà payée', 400);

      amount     = order.total_amount;
      businessId = order.business_id;
      itemName   = `Commande #${body.order_id.slice(0, 8)}`;

    } else if (body.booking_id) {
      const { data: booking, error } = await supabase
        .from('bookings')
        .select('id, total_amount, business_id, payment_status')
        .eq('id', body.booking_id)
        .single();

      if (error || !booking) return jsonError('Réservation introuvable', 404);
      if (booking.payment_status === 'paid') return jsonError('Réservation déjà payée', 400);

      amount     = booking.total_amount;
      businessId = booking.business_id;
      itemName   = `Réservation #${body.booking_id!.slice(0, 8)}`;
    }

    if (!amount || amount <= 0) return jsonError('Montant invalide');

    // ── 4. Récupérer les infos de la boutique ─────────────────
    const { data: business } = await supabase
      .from('businesses')
      .select('name, status')
      .eq('id', businessId)
      .single();

    if (business?.status === 'suspended') {
      return jsonError('Cette boutique est suspendue', 403);
    }

    // ── 5. Créer la facture PayDunya ──────────────────────────
    const invoicePayload = {
      invoice: {
        items: {
          item_0: {
            name:        itemName,
            quantity:    1,
            unit_price:  String(amount),
            total_price: String(amount),
            description: `Paiement via ${body.payment_method}`,
          },
        },
        channels:     body.payment_method,
        total_amount: amount,
        description:  `Paiement ${business?.name ?? 'Bimoh'} — ${itemName}`,
      },
      store: {
        name:        business?.name ?? 'Bimoh',
        tagline:     'Paiement sécurisé',
        website_url: 'https://bimoh.app',
      },
      custom_data: {
        order_id:    body.order_id   ?? null,
        booking_id:  body.booking_id ?? null,
        business_id: businessId,
        user_id:     user.id,
      },
      actions: {
        callback_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-webhook`,
        return_url:   'bimoh://payment/success',
        cancel_url:   'bimoh://payment/cancel',
      },
    };

    const invoiceRes = await fetch(`${PAYDUNYA_BASE}/checkout-invoice/create`, {
      method:  'POST',
      headers: PAYDUNYA_HEADERS,
      body:    JSON.stringify(invoicePayload),
    });

    const invoiceData: PayDunyaInvoiceResponse = await invoiceRes.json();

    if (invoiceData.response_code !== '00') {
      console.error('PayDunya invoice error:', invoiceData);
      return jsonError(`Erreur PayDunya : ${invoiceData.response_text}`, 502);
    }

    const paydunyaToken = invoiceData.token;

    // ── 6. Enregistrer la transaction (statut pending) ────────
    const { data: transaction, error: txError } = await supabase
      .from('payment_transactions')
      .insert({
        order_id:           body.order_id   ?? null,
        booking_id:         body.booking_id ?? null,
        business_id:        businessId,
        amount,
        currency:           'XOF',
        paydunya_token:     paydunyaToken,
        payment_method:     body.payment_method,
        country:            body.country ?? null,
        status:             'pending',
        customer_name:      body.customer_name,
        customer_email:     body.customer_email,
        customer_phone:     body.customer_phone,
        metadata:           { invoice_response: invoiceData },
      })
      .select('id')
      .single();

    if (txError) {
      console.error('DB insert error:', txError);
      return jsonError('Erreur lors de l\'enregistrement de la transaction', 500);
    }

    // Marquer la commande/réservation comme paiement en cours
    if (body.order_id) {
      await supabase.from('orders').update({
        payment_status:        'pending',
        payment_transaction_id: transaction.id,
      }).eq('id', body.order_id);
    } else if (body.booking_id) {
      await supabase.from('bookings').update({
        payment_status:        'pending',
        payment_transaction_id: transaction.id,
      }).eq('id', body.booking_id);
    }

    // ── 7. Appeler SoftPay pour déclencher le paiement ────────
    // Méthodes avec redirection (Wave, Carte) : on retourne juste l'URL
    if (REDIRECT_METHODS.has(body.payment_method)) {
      // Pour Wave et Carte → le client sera redirigé vers la page PayDunya
      const softpayBody = buildSoftpayBody(
        body.payment_method,
        paydunyaToken,
        body.customer_name,
        body.customer_email,
        body.customer_phone,
      );

      const softpayRes  = await fetch(
        `${PAYDUNYA_BASE}/softpay/${body.payment_method}`,
        { method: 'POST', headers: PAYDUNYA_HEADERS, body: JSON.stringify(softpayBody) },
      );
      const softpayData = await softpayRes.json();

      return jsonOk({
        transaction_id: transaction.id,
        type:           'redirect',
        redirect_url:   softpayData.url ?? invoiceData.response_text,
        token:          paydunyaToken,
        message:        softpayData.message ?? 'Redirigez le client vers la page de paiement',
      });
    }

    // Méthodes sans redirection (MTN, Moov, Orange) → USSD push
    const softpayBody = buildSoftpayBody(
      body.payment_method,
      paydunyaToken,
      body.customer_name,
      body.customer_email,
      body.customer_phone,
    );

    const softpayRes  = await fetch(
      `${PAYDUNYA_BASE}/softpay/${body.payment_method}`,
      { method: 'POST', headers: PAYDUNYA_HEADERS, body: JSON.stringify(softpayBody) },
    );
    const softpayData = await softpayRes.json();

    if (!softpayData.success) {
      // Échec SoftPay → marquer la transaction comme failed
      await supabase.from('payment_transactions')
        .update({ status: 'failed', metadata: { invoice_response: invoiceData, softpay_response: softpayData } })
        .eq('id', transaction.id);

      return jsonError(
        softpayData.message ?? 'Échec du déclenchement du paiement',
        502,
        { transaction_id: transaction.id },
      );
    }

    // Succès SoftPay → le client a reçu la notification USSD
    return jsonOk({
      transaction_id: transaction.id,
      type:           'ussd',
      token:          paydunyaToken,
      message:        softpayData.message ?? 'Vérifiez votre téléphone pour confirmer le paiement',
      fees:           softpayData.fees    ?? null,
      currency:       softpayData.currency ?? 'XOF',
    });

  } catch (err) {
    console.error('initiate-payment error:', err);
    return jsonError('Erreur interne du serveur', 500);
  }
});

// ── Helpers de réponse ───────────────────────────────────────

function jsonOk(data: Record<string, unknown>) {
  return new Response(JSON.stringify({ success: true, ...data }), {
    status:  200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return new Response(JSON.stringify({ success: false, error: message, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
