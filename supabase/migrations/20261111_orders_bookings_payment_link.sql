-- ============================================================
-- Migration : Lien orders/bookings → payment_transactions
-- Date      : 2026-11-11
-- ============================================================

-- ── Lien sur orders ──────────────────────────────────────────
-- Référence vers le paiement qui a finalisé cette commande.
-- NULL tant que le paiement n'est pas confirmé.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_transaction_id UUID
    REFERENCES payment_transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_payment_transaction_id
  ON orders(payment_transaction_id);

COMMENT ON COLUMN orders.payment_transaction_id IS
  'Référence vers le paiement PayDunya qui a confirmé cette commande.';


-- ── Lien sur bookings ────────────────────────────────────────
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_transaction_id UUID
    REFERENCES payment_transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_payment_transaction_id
  ON bookings(payment_transaction_id);

COMMENT ON COLUMN bookings.payment_transaction_id IS
  'Référence vers le paiement PayDunya qui a confirmé cette réservation.';


-- ── Colonne payment_status sur orders ───────────────────────
-- Découple le statut de paiement du statut de livraison.
-- 'unpaid' | 'pending' | 'paid' | 'refunded'

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','pending','paid','refunded'));

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','pending','paid','refunded'));

COMMENT ON COLUMN orders.payment_status IS
  'Statut du paiement indépendant du statut de livraison/commande.';

COMMENT ON COLUMN bookings.payment_status IS
  'Statut du paiement indépendant du statut de la réservation.';
