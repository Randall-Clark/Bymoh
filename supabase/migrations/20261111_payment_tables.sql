-- ============================================================
-- Migration : Intégration PayDunya — tables de paiement
-- Date      : 2026-11-11
-- ============================================================

-- ── 1. payment_transactions ─────────────────────────────────
-- Journal de chaque tentative de paiement client.
-- Une commande peut avoir plusieurs tentatives (échecs puis succès).

CREATE TABLE IF NOT EXISTS payment_transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Liens vers la commande ou réservation concernée (au moins un requis)
  order_id            TEXT REFERENCES orders(id) ON DELETE SET NULL,
  booking_id          TEXT REFERENCES bookings(id) ON DELETE SET NULL,
  business_id         TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  -- Montant en XOF (entiers, pas de décimales en FCFA)
  amount              INTEGER NOT NULL CHECK (amount > 0),
  currency            TEXT NOT NULL DEFAULT 'XOF',

  -- Infos PayDunya
  paydunya_token      TEXT UNIQUE,          -- token retourné par PayDunya à la création
  paydunya_invoice_id TEXT,                 -- ID interne de la facture PayDunya

  -- Méthode et pays choisis par le client
  -- Exemples : 'mtn-benin', 'wave-senegal', 'orange-money-ci', 'moov-togo', 'card'
  payment_method      TEXT,
  -- Code ISO pays : 'BJ', 'SN', 'CI', 'TG'
  country             TEXT,

  -- Statut du paiement
  -- pending → completed | failed | cancelled
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','completed','failed','cancelled')),

  -- Infos client (requis par PayDunya pour créer la facture)
  customer_name       TEXT,
  customer_email      TEXT,
  customer_phone      TEXT,

  -- Timestamps clés
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- settled_at : moment où PayDunya confirme que l'argent est disponible
  -- (null tant que le webhook settlement n'est pas reçu)
  settled_at          TIMESTAMPTZ,

  -- Réponse brute de PayDunya (pour debug et audit)
  metadata            JSONB
);

-- Index pour les lookups fréquents
CREATE INDEX idx_payment_transactions_order_id     ON payment_transactions(order_id);
CREATE INDEX idx_payment_transactions_booking_id   ON payment_transactions(booking_id);
CREATE INDEX idx_payment_transactions_business_id  ON payment_transactions(business_id);
CREATE INDEX idx_payment_transactions_status       ON payment_transactions(status);
CREATE INDEX idx_payment_transactions_paydunya_token ON payment_transactions(paydunya_token);

-- Trigger pour updated_at automatique
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payment_transactions_updated_at
  BEFORE UPDATE ON payment_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ── 2. merchant_payout_requests ─────────────────────────────
-- Demandes de retrait initiées par le marchand depuis l'app.
-- Différent de wallet_payout_requests (suspension boutique).

CREATE TABLE IF NOT EXISTS merchant_payout_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  -- Montant demandé en XOF
  amount              INTEGER NOT NULL CHECK (amount > 0),
  currency            TEXT NOT NULL DEFAULT 'XOF',

  -- Méthode de retrait choisie par le marchand
  -- Exemples : 'mtn-benin', 'wave-senegal', 'orange-money-ci', 'moov-togo'
  payout_method       TEXT NOT NULL,

  -- Numéro Mobile Money destinataire (numéro du marchand)
  recipient_phone     TEXT NOT NULL,
  recipient_name      TEXT NOT NULL,

  -- Référence PayDunya retournée après le déboursement
  paydunya_reference  TEXT UNIQUE,

  -- Statut du retrait
  -- pending → processing → completed | failed
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','processing','completed','failed')),

  -- Raison d'échec si applicable
  failure_reason      TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Moment où le marchand a effectivement reçu l'argent (confirmé par webhook)
  completed_at        TIMESTAMPTZ
);

CREATE INDEX idx_merchant_payout_requests_business_id ON merchant_payout_requests(business_id);
CREATE INDEX idx_merchant_payout_requests_status      ON merchant_payout_requests(status);

CREATE TRIGGER trg_merchant_payout_requests_updated_at
  BEFORE UPDATE ON merchant_payout_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ── 3. merchant_payment_methods ─────────────────────────────
-- Numéros Mobile Money enregistrés par le marchand pour ses retraits.
-- Équivalent des "comptes de retrait" dans le dashboard PayDunya.

CREATE TABLE IF NOT EXISTS merchant_payment_methods (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  -- Méthode : 'mtn-benin', 'wave-senegal', 'orange-money-ci', 'moov-togo', etc.
  method              TEXT NOT NULL,

  -- Numéro de téléphone Mobile Money (format international : +22961xxxxxxx)
  phone               TEXT NOT NULL,

  -- Nom du titulaire du compte Mobile Money
  account_name        TEXT NOT NULL,

  -- Compte principal du marchand (un seul par business)
  is_default          BOOLEAN NOT NULL DEFAULT false,

  -- Vérifié : le marchand a confirmé ce numéro
  is_verified         BOOLEAN NOT NULL DEFAULT false,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Un seul compte par défaut par business
  UNIQUE (business_id, method, phone)
);

CREATE INDEX idx_merchant_payment_methods_business_id ON merchant_payment_methods(business_id);

-- Garantir un seul is_default = true par business
CREATE UNIQUE INDEX idx_merchant_payment_methods_default
  ON merchant_payment_methods(business_id)
  WHERE is_default = true;

CREATE TRIGGER trg_merchant_payment_methods_updated_at
  BEFORE UPDATE ON merchant_payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
