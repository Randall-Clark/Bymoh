// ============================================================
// _pawapay.ts — Webhook PawaPay (à compléter quand actif)
// PawaPay envoie des webhooks JSON signés via HMAC-SHA256
// ============================================================

import type { WebhookParseResult, WebhookConfirmResult } from './_paydunya.ts';

export async function parseWebhookBody(req: Request): Promise<WebhookParseResult | null> {
  // TODO: implémenter quand compte PawaPay actif
  // PawaPay envoie du JSON avec signature dans le header X-PawaPay-Signature
  // Body: { depositId, status, amount, currency, correspondent, payer, ... }
  void req;
  throw new Error('PawaPay webhook not yet implemented');
}

export async function verifyHash(_signature: string): Promise<boolean> {
  // TODO: vérifier HMAC-SHA256 avec PAWAPAY_WEBHOOK_SECRET
  // const expected = hmac('sha256', PAWAPAY_WEBHOOK_SECRET, rawBody)
  // return signature === expected
  return false;
}

export async function confirmPayment(_gateway_token: string): Promise<WebhookConfirmResult | null> {
  // TODO: GET /v1/deposits/{depositId}
  return null;
}

export type { WebhookParseResult, WebhookConfirmResult };
