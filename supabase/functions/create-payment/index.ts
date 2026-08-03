import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const FEDAPAY_SECRET = Deno.env.get('FEDAPAY_SECRET_KEY')!;
const FEDAPAY_URL    = 'https://sandbox-api.fedapay.com/v1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { amount, description, customer, callback_url, method, phone_number } = body;

    // 1 — Créer la transaction FedaPay
    const txRes = await fetch(`${FEDAPAY_URL}/transactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FEDAPAY_SECRET}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        description,
        amount,
        currency:     { iso: 'XOF' },
        callback_url: callback_url ?? 'https://bymoh.app/payment/callback',
        customer,
      }),
    });

    const txData = await txRes.json();
    const transactionId = txData.v1?.transaction?.id;

    if (!transactionId) {
      throw new Error('FedaPay: transaction non créée — ' + JSON.stringify(txData));
    }

    // 2 — Générer le lien de paiement (checkout token)
    const tokenRes = await fetch(`${FEDAPAY_URL}/transactions/${transactionId}/token`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${FEDAPAY_SECRET}` },
    });
    const tokenData = await tokenRes.json();

    return new Response(JSON.stringify({
      transaction_id: transactionId,
      checkout_url:   tokenData.v1?.token?.url ?? null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});