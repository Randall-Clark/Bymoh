// ============================================================
// _paydunya.ts — Vérification et confirmation PayDunya IPN
// ============================================================

import { crypto }    from 'https://deno.land/std@0.177.0/crypto/mod.ts';
import { encodeHex } from 'https://deno.land/std@0.177.0/encoding/hex.ts';

const MODE    = Deno.env.get('PAYDUNYA_MODE') ?? 'sandbox';
const BASE    = MODE === 'live'
  ? 'https://app.paydunya.com/api/v1'
  : 'https://app.paydunya.com/sandbox-api/v1';

const MASTER_KEY  = Deno.env.get('PAYDUNYA_MASTER_KEY')  ?? '';
const PRIVATE_KEY = Deno.env.get('PAYDUNYA_PRIVATE_KEY') ?? '';
const TOKEN       = Deno.env.get('PAYDUNYA_TOKEN')       ?? '';

const HEADERS = {
  'Content-Type':         'application/json',
  'PAYDUNYA-MASTER-KEY':  MASTER_KEY,
  'PAYDUNYA-PRIVATE-KEY': PRIVATE_KEY,
  'PAYDUNYA-TOKEN':       TOKEN,
};

export interface WebhookParseResult {
  gateway_token:  string;
  received_hash?: string;
  raw:            Record<string, unknown>;
}

export interface WebhookConfirmResult {
  gateway_token:   string;
  status:          'completed' | 'cancelled' | 'failed';
  confirmed_amount: number;
}

// ── 1. Parser le body IPN PayDunya ───────────────────────────
// PayDunya envoie application/x-www-form-urlencoded avec une clé "data" JSON

export async function parseWebhookBody(req: Request): Promise<WebhookParseResult | null> {
  const contentType = req.headers.get('content-type') ?? '';
  let ipnData: Record<string, unknown> = {};

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text   = await req.text();
    const params = new URLSearchParams(text);
    const rawData = params.get('data');
    if (rawData) {
      try { ipnData = JSON.parse(rawData); } catch { ipnData = {}; }
    }
  } else {
    ipnData = await req.json().catch(() => ({}));
  }

  if (!ipnData || Object.keys(ipnData).length === 0) return null;

  const invoice = ipnData.invoice as Record<string, unknown> | undefined;
  const gateway_token = (invoice?.token ?? ipnData.token) as string | undefined;
  if (!gateway_token) return null;

  return {
    gateway_token,
    received_hash: ipnData.hash as string | undefined,
    raw: ipnData,
  };
}

// ── 2. Vérifier l'authenticité du hash IPN ───────────────────

export async function verifyHash(receivedHash: string): Promise<boolean> {
  const encoder    = new TextEncoder();
  const keyData    = encoder.encode(MASTER_KEY);
  const hashBuffer = await crypto.subtle.digest('SHA-512', keyData);
  const expected   = encodeHex(new Uint8Array(hashBuffer));
  return receivedHash === expected;
}

// ── 3. Confirmer le statut auprès de PayDunya ────────────────
// Ne jamais faire confiance au seul IPN — toujours reconfirmer

export async function confirmPayment(gateway_token: string): Promise<WebhookConfirmResult | null> {
  const res  = await fetch(`${BASE}/checkout-invoice/confirm/${gateway_token}`, {
    method: 'GET', headers: HEADERS,
  });
  const data = await res.json();

  if (data.response_code !== '00') {
    console.error('Échec confirmation PayDunya:', data);
    return null;
  }

  const rawStatus: string = data.status ?? 'failed';
  const status: WebhookConfirmResult['status'] =
    rawStatus === 'completed' ? 'completed' :
    rawStatus === 'cancelled' ? 'cancelled' : 'failed';

  return {
    gateway_token,
    status,
    confirmed_amount: data.invoice?.total_amount ?? 0,
  };
}
