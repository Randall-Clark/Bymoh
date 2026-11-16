// ============================================================
// _paydunya.ts — Déboursement PayDunya (retrait marchand)
// ============================================================

export interface PayoutParams {
  phone_number:   string;
  amount:         number;
  payment_method: string;
  full_name:      string;
  business_name:  string;
}

export interface PayoutResult {
  gateway_reference: string;   // transaction_id retourné par PayDunya
  raw_response:      Record<string, unknown>;
}

const MODE    = Deno.env.get('PAYDUNYA_MODE') ?? 'sandbox';
const BASE    = MODE === 'live'
  ? 'https://app.paydunya.com/api/v1'
  : 'https://app.paydunya.com/sandbox-api/v1';

const HEADERS = {
  'Content-Type':         'application/json',
  'PAYDUNYA-MASTER-KEY':  Deno.env.get('PAYDUNYA_MASTER_KEY')  ?? '',
  'PAYDUNYA-PRIVATE-KEY': Deno.env.get('PAYDUNYA_PRIVATE_KEY') ?? '',
  'PAYDUNYA-TOKEN':       Deno.env.get('PAYDUNYA_TOKEN')        ?? '',
};

// Correspondance méthode interne → withdraw_mode PayDunya
const WITHDRAW_MODE_MAP: Record<string, string> = {
  'mtn-benin':            'mtn-benin',
  'moov-benin':           'moov-benin',
  'mtn-ci':               'mtn-ci',
  'moov-ci':              'moov-ci',
  'orange-money-ci':      'orange-ci',
  'wave-ci':              'wave-ci',
  't-money-togo':         'tmoney-togo',
  'moov-togo':            'moov-togo',
  'wave-senegal':         'wave-senegal',
  'orange-money-senegal': 'orange-senegal',
  'free-money-senegal':   'free-senegal',
  'expresso':             'expresso',
};

export function getSupportedMethods(): Set<string> {
  return new Set(Object.keys(WITHDRAW_MODE_MAP));
}

export async function requestPayout(p: PayoutParams): Promise<PayoutResult> {
  const withdraw_mode = WITHDRAW_MODE_MAP[p.payment_method];
  if (!withdraw_mode) {
    throw new Error(`Méthode non supportée par PayDunya: ${p.payment_method}`);
  }

  const payload = {
    account_alias: p.phone_number,
    amount:        p.amount,
    withdraw_mode,
    business_name: p.business_name,
    full_name:     p.full_name,
    description:   `Retrait marchand - ${p.business_name}`,
  };

  const res  = await fetch(`${BASE}/disburse/get-invoice`, {
    method:  'POST',
    headers: HEADERS,
    body:    JSON.stringify(payload),
  });
  const data = await res.json();

  if (data.response_code !== '00') {
    throw new Error(data.response_text ?? 'Erreur déboursement PayDunya');
  }

  return {
    gateway_reference: data.transaction_id ?? data.disburse_invoice ?? '',
    raw_response:      data,
  };
}
