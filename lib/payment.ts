// lib/payment.ts
// ── Service de paiement centralisé — FedaPay ─────────────────────────────────
import { supabase } from '@/lib/supabase';

export type PaymentMethod =
  | 'mtn_momo'    // MTN Mobile Money (priorité 1)
  | 'moov_money'  // Moov Money / Flooz (priorité 2)
  | 'card'        // Visa / Mastercard (priorité 3)
  | 'orange_money'
  | 'celtis'
  | 'wave';

export interface PaymentRequest {
  amount:      number;           // en FCFA
  description: string;
  purpose:     PaymentPurpose;
  userId:      string;
  metadata?:   Record<string, unknown>;
}

export type PaymentPurpose =
  | 'wallet_recharge'      // Recharge portefeuille client
  | 'business_registration' // Création compte marchand
  | 'order_payment'        // Paiement commande
  | 'booking_payment';     // Paiement réservation

export interface PaymentResult {
  success:        boolean;
  transactionId?: string;
  checkoutUrl?:   string;    // URL WebView pour carte / certains MoMo
  error?:         string;
}

// ── Labels affichés à l'utilisateur ──────────────────────────────────────────
export const PAYMENT_METHODS: {
  id: PaymentMethod;
  label: string;
  emoji: string;
  description: string;
  available: boolean;
}[] = [
  { id: 'mtn_momo',    label: 'MTN Mobile Money', emoji: '🟡', description: 'Paiement via MTN MoMo',       available: true  },
  { id: 'moov_money',  label: 'Moov Money',        emoji: '🔵', description: 'Paiement via Flooz',          available: true  },
  { id: 'card',        label: 'Carte bancaire',     emoji: '💳', description: 'Visa / Mastercard',           available: true  },
  { id: 'orange_money',label: 'Orange Money',       emoji: '🟠', description: 'Paiement via Orange Money',   available: false },
  { id: 'celtis',      label: 'Celtis Money',       emoji: '🟢', description: 'Paiement via Celtis',         available: false },
  { id: 'wave',        label: 'Wave',               emoji: '🔷', description: 'Paiement via Wave',           available: false },
];

// Mapping méthode → code FedaPay
const FEDAPAY_METHOD_MAP: Record<PaymentMethod, string> = {
  mtn_momo:     'MTN',
  moov_money:   'MOOV',
  card:         'CARD',
  orange_money: 'ORANGE',
  celtis:       'CELTIS',
  wave:         'WAVE',
};

// ── Initier un paiement via Supabase Edge Function ────────────────────────────
export async function initiatePayment(
  request: PaymentRequest,
  method: PaymentMethod,
  phoneNumber?: string,  // requis pour mobile money
): Promise<PaymentResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Non authentifié');

    // Appel à la Supabase Edge Function (clé API sécurisée côté serveur)
    const { data, error } = await supabase.functions.invoke('create-payment', {
      body: {
        amount:       request.amount,
        description:  request.description,
        purpose:      request.purpose,
        user_id:      request.userId,
        method:       FEDAPAY_METHOD_MAP[method],
        phone_number: phoneNumber ?? null,
        metadata:     request.metadata ?? {},
        callback_url: 'https://bymoh.app/payment/callback',
        customer: {
          email:    user.email ?? `${request.userId}@bymoh.app`,
          phone:    phoneNumber ?? user.phone ?? '',
        },
      },
    });

    if (error) throw error;

    return {
      success:       true,
      transactionId: data.transaction_id,
      checkoutUrl:   data.checkout_url,
    };
  } catch (err: any) {
    return {
      success: false,
      error:   err.message ?? 'Erreur de paiement',
    };
  }
}

// ── Vérifier le statut d'un paiement ─────────────────────────────────────────
export async function checkPaymentStatus(transactionId: string): Promise<'pending' | 'approved' | 'declined'> {
  try {
    const { data, error } = await supabase.functions.invoke('check-payment', {
      body: { transaction_id: transactionId },
    });
    if (error) throw error;
    return data.status ?? 'pending';
  } catch {
    return 'pending';
  }
}

// ── Formater le montant en FCFA ───────────────────────────────────────────────
export function formatAmount(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} FCFA`;
}
