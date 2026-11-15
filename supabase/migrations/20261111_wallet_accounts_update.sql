-- ============================================================
-- Migration : Mise à jour wallet_accounts pour PayDunya
-- Date      : 2026-11-11
-- ============================================================

-- ── Ajout des colonnes manquantes sur wallet_accounts ───────
--
-- Avant : balance + pending_balance (sans distinction claire)
-- Après :
--   pending_balance   = argent reçu, settlement en cours (T+1/T+2)
--   available_balance = argent validé, retirable maintenant
--   total_earned      = total historique encaissé (stats marchand)

-- available_balance : argent prêt à être retiré
ALTER TABLE wallet_accounts
  ADD COLUMN IF NOT EXISTS available_balance INTEGER NOT NULL DEFAULT 0
    CHECK (available_balance >= 0);

-- total_earned : cumul historique (ne diminue jamais, sert aux stats)
ALTER TABLE wallet_accounts
  ADD COLUMN IF NOT EXISTS total_earned INTEGER NOT NULL DEFAULT 0
    CHECK (total_earned >= 0);

-- S'assurer que pending_balance existe avec la bonne contrainte
-- (au cas où elle n'aurait pas de CHECK)
ALTER TABLE wallet_accounts
  ADD COLUMN IF NOT EXISTS pending_balance INTEGER NOT NULL DEFAULT 0
    CHECK (pending_balance >= 0);

-- S'assurer que balance existe (solde brut historique, peut rester pour compatibilité)
ALTER TABLE wallet_accounts
  ADD COLUMN IF NOT EXISTS balance INTEGER NOT NULL DEFAULT 0
    CHECK (balance >= 0);

-- ── Commentaires explicatifs ─────────────────────────────────
COMMENT ON COLUMN wallet_accounts.pending_balance IS
  'Argent reçu mais settlement en cours (T+1/T+2 PayDunya). Non retirable.';

COMMENT ON COLUMN wallet_accounts.available_balance IS
  'Argent validé par PayDunya (settled_at renseigné). Retirable par le marchand.';

COMMENT ON COLUMN wallet_accounts.total_earned IS
  'Cumul total encaissé depuis la création du compte. Ne diminue jamais.';

COMMENT ON COLUMN wallet_accounts.balance IS
  'Solde brut (pending + available). Conservé pour compatibilité avec l ancien code.';
