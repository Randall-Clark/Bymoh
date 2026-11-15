// ============================================================
// _paydunya.ts — Logique PayDunya isolée
// Remplacer ce fichier par _pawapay.ts quand la migration aura lieu
// ============================================================

export interface GatewayInitParams {
  amount:        number;
  payment_method: string;
  customer_name:  string;
  customer_email: string;
  customer_phone: string;
  order_id?:      string | null;
  booking_id?:    string | null;
  business_id:    string;
  business_name:  string;
  user_id:        string;
  callback_url:   string;
}

export interface GatewayInitResult {
  type:          'ussd' | 'redirect';
  gateway_token: string;             // token PayDunya ou reference PawaPay
  redirect_url?: string;             // uniquement si type = 'redirect'
  message:       string;
  fees?:         number | null;
  currency:      string;
}

// ── Config ───────────────────────────────────────────────────

const MODE    = Deno.env.get('PAYDUNYA_MODE') ?? 'sandbox';
const BASE    = MODE === 'live'
  ? 'https://app.paydunya.com/api/v1'
  : 'https://app.paydunya.com/sandbox-api/v1';

const HEADERS = {
  'Content-Type':         'application/json',
  'PAYDUNYA-MASTER-KEY':  Deno.env.get('PAYDUNYA_MASTER_KEY') ?? '',
  'PAYDUNYA-PRIVATE-KEY': Deno.env.get('PAYDUNYA_PRIVATE_KEY') ?? '',
  'PAYDUNYA-TOKEN':       Deno.env.get('PAYDUNYA_TOKEN') ?? '',
};

// Méthodes qui retournent une URL (WebView côté app)
export const REDIRECT_METHODS = new Set(['wave-senegal', 'wave-ci', 'card']);

// ── Étape 1 : Créer la facture PayDunya ──────────────────────

async function createInvoice(p: GatewayInitParams): Promise<string> {
  const itemName = p.order_id
    ? `Commande #${p.order_id.slice(0, 8)}`
    : `Réservation #${(p.booking_id ?? '').slice(0, 8)}`;

  const payload = {
    invoice: {
      items: {
        item_0: {
          name:        itemName,
          quantity:    1,
          unit_price:  String(p.amount),
          total_price: String(p.amount),
          description: `Paiement via ${p.payment_method}`,
        },
      },
      channels:     p.payment_method,
      total_amount: p.amount,
      description:  `Paiement ${p.business_name} — ${itemName}`,
    },
    store: {
      name:        p.business_name,
      tagline:     'Paiement sécurisé',
      website_url: 'https://bimoh.app',
    },
    custom_data: {
      order_id:    p.order_id    ?? null,
      booking_id:  p.booking_id  ?? null,
      business_id: p.business_id,
      user_id:     p.user_id,
    },
    actions: {
      callback_url: p.callback_url,
      return_url:   'bimoh://payment/success',
      cancel_url:   'bimoh://payment/cancel',
    },
  };

  const res  = await fetch(`${BASE}/checkout-invoice/create`, {
    method: 'POST', headers: HEADERS, body: JSON.stringify(payload),
  });
  const data = await res.json();

  if (data.response_code !== '00') {
    throw new Error(`PayDunya invoice error: ${data.response_text}`);
  }
  return data.token as string;
}

// ── Étape 2 : Déclencher SoftPay ─────────────────────────────

function buildSoftpayBody(
  method: string,
  token:  string,
  name:   string,
  email:  string,
  phone:  string,
): Record<string, string> {
  switch (method) {
    case 'mtn-benin':
      return { mtn_benin_customer_fullname: name, mtn_benin_email: email, mtn_benin_phone_number: phone, mtn_benin_wallet_provider: 'MTNBENIN', payment_token: token };
    case 'moov-benin':
      return { moov_benin_customer_fullname: name, moov_benin_email: email, moov_benin_phone_number: phone, payment_token: token };
    case 'wave-senegal':
      return { wave_senegal_fullName: name, wave_senegal_email: email, wave_senegal_phone: phone, wave_senegal_payment_token: token };
    case 'orange-money-senegal':
      return { orange_money_senegal_fullname: name, orange_money_senegal_email: email, orange_money_senegal_phone: phone, payment_token: token };
    case 'free-money-senegal':
      return { free_money_senegal_fullname: name, free_money_senegal_email: email, free_money_senegal_phone: phone, payment_token: token };
    case 'mtn-ci':
      return { mtn_ci_customer_fullname: name, mtn_ci_email: email, mtn_ci_phone_number: phone, payment_token: token };
    case 'orange-money-ci':
      return { orange_money_ci_fullname: name, orange_money_ci_email: email, orange_money_ci_phone: phone, payment_token: token };
    case 'wave-ci':
      return { wave_ci_fullName: name, wave_ci_email: email, wave_ci_phone: phone, wave_ci_payment_token: token };
    case 'moov-ci':
      return { moov_ci_customer_fullname: name, moov_ci_email: email, moov_ci_phone_number: phone, payment_token: token };
    case 't-money-togo':
      return { t_money_togo_fullname: name, t_money_togo_email: email, t_money_togo_phone: phone, payment_token: token };
    case 'moov-togo':
      return { moov_togo_fullname: name, moov_togo_email: email, moov_togo_phone: phone, payment_token: token };
    default:
      return { payment_token: token };
  }
}

// ── Point d'entrée public du module ──────────────────────────

export async function initiatePayment(p: GatewayInitParams): Promise<GatewayInitResult> {
  const token = await createInvoice(p);

  const softpayBody = buildSoftpayBody(p.payment_method, token, p.customer_name, p.customer_email, p.customer_phone);

  const softpayRes  = await fetch(`${BASE}/softpay/${p.payment_method}`, {
    method: 'POST', headers: HEADERS, body: JSON.stringify(softpayBody),
  });
  const softpayData = await softpayRes.json();

  if (REDIRECT_METHODS.has(p.payment_method)) {
    return {
      type:          'redirect',
      gateway_token: token,
      redirect_url:  softpayData.url ?? softpayData.redirect_url ?? '',
      message:       softpayData.message ?? 'Redirigez le client vers la page de paiement',
      currency:      'XOF',
    };
  }

  if (!softpayData.success) {
    throw new Error(softpayData.message ?? 'Échec SoftPay');
  }

  return {
    type:          'ussd',
    gateway_token: token,
    message:       softpayData.message ?? 'Vérifiez votre téléphone pour confirmer le paiement',
    fees:          softpayData.fees ?? null,
    currency:      softpayData.currency ?? 'XOF',
  };
}
