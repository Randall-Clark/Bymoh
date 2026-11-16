// ============================================================
// _pawapay.ts — Déboursement PawaPay (à compléter quand actif)
// PawaPay : POST /v1/payouts avec un payoutId UUID unique
// ============================================================

import type { PayoutParams, PayoutResult } from './_paydunya.ts';

// Correspondance méthode interne → correspondent PawaPay
export const PAWAPAY_PAYOUT_MAP: Record<string, string> = {
  'mtn-benin':            'MTN_MOMO_BEN',
  'moov-benin':           'MOOV_BEN',
  'mtn-ci':               'MTN_MOMO_CIV',
  'moov-ci':              'MOOV_CIV',
  'orange-money-ci':      'ORANGE_CIV',
  'wave-ci':              'WAVE_CIV',
  't-money-togo':         'TOGOCEL_TGO',
  'moov-togo':            'MOOV_TGO',
  'wave-senegal':         'WAVE_SEN',
  'orange-money-senegal': 'ORANGE_SEN',
  'free-money-senegal':   'FREE_SEN',
};

export function getSupportedMethods(): Set<string> {
  return new Set(Object.keys(PAWAPAY_PAYOUT_MAP));
}

export async function requestPayout(_p: PayoutParams): Promise<PayoutResult> {
  // TODO: implémenter quand compte PawaPay actif
  // Flux :
  // 1. Générer un payoutId UUID unique
  // 2. POST /v1/payouts { payoutId, amount, currency: 'XOF', correspondent, recipient: { type: 'MSISDN', address: { value: phone } }, ... }
  // 3. Retourner { gateway_reference: payoutId, raw_response: data }
  throw new Error('PawaPay payout not yet implemented');
}

export type { PayoutParams, PayoutResult };
