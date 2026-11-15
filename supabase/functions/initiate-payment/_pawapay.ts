// ============================================================
// _pawapay.ts — Logique PawaPay (à compléter quand le compte sera actif)
// Implémente la même interface que _paydunya.ts
// ============================================================

import type { GatewayInitParams, GatewayInitResult } from './_paydunya.ts';

// PawaPay couvre : CI, SN, TG, GH, TZ, UG, RW, ZM, CD, CM...
// Correspondance méthode → paysId PawaPay
const PAWAPAY_CORRESPONDENT_MAP: Record<string, string> = {
  'mtn-ci':              'MTN_MOMO_CIV',
  'orange-money-ci':     'ORANGE_CIV',
  'wave-ci':             'WAVE_CIV',
  'moov-ci':             'MOOV_CIV',
  'wave-senegal':        'WAVE_SEN',
  'orange-money-senegal':'ORANGE_SEN',
  'free-money-senegal':  'FREE_SEN',
  't-money-togo':        'TOGOCEL_TGO',
  'moov-togo':           'MOOV_TGO',
  'mtn-benin':           'MTN_MOMO_BEN',
  'moov-benin':          'MOOV_BEN',
};

export const REDIRECT_METHODS = new Set<string>(); // PawaPay = tout en push, pas de redirect

export async function initiatePayment(_p: GatewayInitParams): Promise<GatewayInitResult> {
  // TODO: implémenter quand le compte PawaPay sera activé
  // Flux PawaPay :
  // 1. POST /v1/deposits  avec { depositId (UUID), amount, currency, correspondent, payer: { type: 'MSISDN', address: { value: phone } }, ... }
  // 2. Polling GET /v1/deposits/{depositId} jusqu'à COMPLETED | FAILED
  //    ou réception du webhook sur /payment-webhook (à adapter)
  // 3. Retourner { type: 'ussd', gateway_token: depositId, message }

  throw new Error('PawaPay not yet implemented — use PayDunya for now');
}

export { type GatewayInitParams, type GatewayInitResult };
export { PAWAPAY_CORRESPONDENT_MAP };
