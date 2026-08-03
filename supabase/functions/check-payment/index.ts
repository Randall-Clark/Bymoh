import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const FEDAPAY_SECRET = Deno.env.get('FEDAPAY_SECRET_KEY')!;
const FEDAPAY_URL    = 'https://api.fedapay.com/v1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const { transaction_id } = await req.json();

  const res = await fetch(`${FEDAPAY_URL}/transactions/${transaction_id}`, {
    headers: { 'Authorization': `Bearer ${FEDAPAY_SECRET}` },
  });
  const data = await res.json();

  const status = data.v1?.transaction?.status ?? 'pending';
  // FedaPay statuts : pending, approved, declined, canceled, refunded

  return new Response(JSON.stringify({ status }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});