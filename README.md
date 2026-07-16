# Bymoh — Documentation Développeur

> Marketplace mobile local (iOS & Android) permettant aux clients de trouver, réserver et commander auprès de commerces locaux en Afrique de l'Ouest, et aux professionnels de gérer leur business depuis leur téléphone.

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Stack technique](#2-stack-technique)
3. [Prérequis](#3-prérequis)
4. [Installation locale](#4-installation-locale)
5. [Variables d'environnement](#5-variables-denvironnement)
6. [Base de données Supabase](#6-base-de-données-supabase)
7. [Lancer l'application](#7-lancer-lapplication)
8. [Structure du projet](#8-structure-du-projet)
9. [Flux d'authentification](#9-flux-dauthentification)
10. [Modifier les éléments visuels](#10-modifier-les-éléments-visuels)
11. [Workflow Git & push GitHub](#11-workflow-git--push-github)
12. [Gotchas & pièges courants](#12-gotchas--pièges-courants)

---

## 1. Vue d'ensemble

Bymoh est une application mobile **Expo** (React Native) connectée à un backend **Supabase** (PostgreSQL + Auth + Storage).

**Deux profils utilisateurs :**
- **Client** — cherche des commerces, réserve des services, commande avec livraison (Gozem / Yango / retrait)
- **Professionnel** — inscrit son commerce (5 étapes), gère son catalogue, ses horaires, ses commandes et consulte son tableau de bord

**Monnaie :** FCFA · **Villes :** Afrique de l'Ouest (Togo, Bénin, Côte d'Ivoire, Sénégal, Ghana…)

---

## 2. Stack technique

| Couche | Technologie | Version |
|---|---|---|
| Framework mobile | Expo (React Native) | SDK 54 |
| Routing | expo-router | v6 |
| Backend / Auth / DB | Supabase | JS SDK v2 |
| Base de données | PostgreSQL (via Supabase) | — |
| ORM | Drizzle ORM | — |
| State management | Zustand | v5 |
| Requêtes serveur | TanStack React Query | v5 |
| Formulaires | React Hook Form + Zod | — |
| Styles | StyleSheet (RN natif) + NativeWind | — |
| Typage | TypeScript | 5.9 |
| Gestionnaire de paquets | pnpm (workspaces) | 9+ |
| Node.js | — | 20+ |

---

## 3. Prérequis

Installer les outils suivants **avant** de cloner le projet :

### 3.1 Node.js (v20 ou supérieur)
```bash
# Vérifier la version installée
node --version   # doit afficher v20.x.x ou supérieur

# Si besoin, installer via nvm (recommandé)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20
nvm use 20
```

### 3.2 pnpm
```bash
# Installer pnpm globalement
npm install -g pnpm@9

# Vérifier
pnpm --version   # doit afficher 9.x.x
```

### 3.3 Expo CLI
```bash
npm install -g @expo/cli
expo --version
```

### 3.4 EAS CLI (pour les builds de production)
```bash
npm install -g eas-cli
eas --version
```

### 3.5 Application Expo Go (sur votre téléphone)
- **iOS** : [App Store — Expo Go](https://apps.apple.com/app/expo-go/id982107779)
- **Android** : [Google Play — Expo Go](https://play.google.com/store/apps/details?id=host.exp.exponent)

### 3.6 Git
```bash
git --version   # doit afficher 2.x.x
```

---

## 4. Installation locale

### 4.1 Cloner le dépôt
```bash
git clone https://github.com/Randall-Clark/Bymoh.git
cd Bymoh
```

### 4.2 Installer les dépendances
```bash
pnpm install
```

> Le projet utilise **pnpm workspaces**. Toutes les dépendances sont installées en une seule commande depuis la racine.

### 4.3 Vérifier que tout compile (TypeScript)
```bash
pnpm run typecheck
```

Si zéro erreur → l'installation est correcte.

---

## 5. Variables d'environnement

Créer un fichier `.env` à la racine du projet Expo (`artifacts/marketplace-app/.env` si vous travaillez dans le monorepo, ou `.env` à la racine si vous avez cloné depuis GitHub) :

```env
# Supabase — récupérer ces valeurs dans Supabase → Settings → API
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> **Important :** les variables préfixées `EXPO_PUBLIC_` sont exposées côté client (app mobile). Ne jamais y mettre de clé secrète (service role key, etc.).

### Où trouver ces valeurs dans Supabase
1. Connectez-vous sur [supabase.com](https://supabase.com)
2. Ouvrez votre projet Bymoh
3. **Settings → API**
4. Copiez :
   - **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

---

## 6. Base de données Supabase

### 6.1 Tables requises

Le schéma suivant doit exister dans votre projet Supabase. Exécutez ce SQL dans **Supabase → SQL Editor** si ce n'est pas déjà fait :

```sql
-- Utilisateurs (liés à auth.users)
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id),
  phone       TEXT NOT NULL,
  name        TEXT NOT NULL,
  email       TEXT,
  role        TEXT NOT NULL DEFAULT 'client',  -- 'client' | 'pro' | 'admin'
  avatar_url  TEXT,
  pin_hash    TEXT,           -- marqueur NIP configuré ('configured' si défini)
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ
);

-- Commerces
CREATE TABLE IF NOT EXISTS businesses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID NOT NULL REFERENCES users(id),
  name         TEXT NOT NULL,
  category     TEXT NOT NULL,
  category_icon TEXT,
  sector       TEXT,
  description  TEXT,
  phone        TEXT,
  email        TEXT,
  address      TEXT NOT NULL,
  city         TEXT NOT NULL,
  cover_url    TEXT,
  rating       NUMERIC DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  has_delivery BOOLEAN DEFAULT FALSE,
  is_open      BOOLEAN DEFAULT TRUE,
  open_hour    TEXT DEFAULT '08:00',
  close_hour   TEXT DEFAULT '20:00',
  is_active    BOOLEAN DEFAULT TRUE,
  is_verified  BOOLEAN DEFAULT FALSE,
  forfait_paid BOOLEAN DEFAULT FALSE,
  latitude     NUMERIC,
  longitude    NUMERIC,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Catalogue de services
CREATE TABLE IF NOT EXISTS services (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  price            NUMERIC NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'FCFA',
  image_url        TEXT,
  duration_minutes INTEGER,
  allows_booking   BOOLEAN DEFAULT FALSE,
  show_stock       BOOLEAN DEFAULT FALSE,
  stock_quantity   INTEGER DEFAULT 0,
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Réservations
CREATE TABLE IF NOT EXISTS bookings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  business_id UUID NOT NULL REFERENCES businesses(id),
  service_id  UUID REFERENCES services(id),
  date        DATE NOT NULL,
  time        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  note        TEXT,
  booking_type TEXT DEFAULT 'service',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Commandes
CREATE TABLE IF NOT EXISTS orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  business_id     UUID NOT NULL REFERENCES businesses(id),
  status          TEXT NOT NULL DEFAULT 'pending',
  delivery_method TEXT NOT NULL DEFAULT 'pickup',  -- 'pickup' | 'gozem' | 'yango'
  subtotal        NUMERIC NOT NULL,
  delivery_fee    NUMERIC DEFAULT 0,
  total           NUMERIC NOT NULL,
  address         TEXT,
  note            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Articles de commande
CREATE TABLE IF NOT EXISTS order_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id),
  title      TEXT NOT NULL,
  price      NUMERIC NOT NULL,
  quantity   INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 6.2 Row Level Security (RLS)

Activer le RLS sur toutes les tables. Exécuter dans **SQL Editor** :

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- users
CREATE POLICY "users: public read" ON users FOR SELECT USING (true);
CREATE POLICY "users: self insert" ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users: self update" ON users FOR UPDATE USING (auth.uid() = id);

-- businesses
CREATE POLICY "businesses: public read" ON businesses FOR SELECT USING (true);
CREATE POLICY "businesses: owner insert" ON businesses FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "businesses: owner update" ON businesses FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "businesses: owner delete" ON businesses FOR DELETE USING (auth.uid() = owner_id);

-- services
CREATE POLICY "services: public read" ON services FOR SELECT USING (true);
CREATE POLICY "services: owner write" ON services FOR ALL
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = services.business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = services.business_id AND b.owner_id = auth.uid()));

-- bookings
CREATE POLICY "bookings: client read" ON bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bookings: owner read" ON bookings FOR SELECT
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = bookings.business_id AND b.owner_id = auth.uid()));
CREATE POLICY "bookings: client insert" ON bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bookings: update" ON bookings FOR UPDATE
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM businesses b WHERE b.id = bookings.business_id AND b.owner_id = auth.uid()));

-- orders
CREATE POLICY "orders: client read" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "orders: owner read" ON orders FOR SELECT
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = orders.business_id AND b.owner_id = auth.uid()));
CREATE POLICY "orders: client insert" ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "orders: owner update" ON orders FOR UPDATE
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = orders.business_id AND b.owner_id = auth.uid()));

-- order_items
CREATE POLICY "order_items: client read" ON order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid()));
CREATE POLICY "order_items: owner read" ON order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders o JOIN businesses b ON b.id = o.business_id WHERE o.id = order_items.order_id AND b.owner_id = auth.uid()));
CREATE POLICY "order_items: client insert" ON order_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid()));
```

### 6.3 Activer le provider Phone (SMS OTP)

Dans **Supabase → Authentication → Providers → Phone** :
1. Activer **Enable Phone provider**
2. Configurer un provider SMS (Twilio ou Vonage) avec vos credentials
3. Activer **"Enable phone confirmations"**

---

## 7. Lancer l'application

### 7.1 Démarrer Metro (bundler Expo)

```bash
# Depuis la racine du projet cloné (ou artifacts/marketplace-app/ dans le monorepo)
npx expo start
```

Vous verrez un QR code dans le terminal.

### 7.2 Ouvrir sur votre téléphone
- **iOS / Android** : scannez le QR code avec l'app **Expo Go**
- **iOS Simulator** (macOS uniquement) : appuyez sur `i` dans le terminal
- **Android Emulator** : appuyez sur `a` dans le terminal
- **Navigateur web** : appuyez sur `w` dans le terminal

> Le téléphone et l'ordinateur doivent être sur le **même réseau Wi-Fi**.

### 7.3 Recharger l'app
- Secouer le téléphone → **Reload**
- Ou appuyez sur `r` dans le terminal Metro

---

## 8. Structure du projet

```
Bymoh/                          ← racine du repo GitHub
├── app/                        ← écrans (routing expo-router)
│   ├── _layout.tsx             ← layout racine + AuthGuard (redirections auth)
│   ├── index.tsx               ← écran d'accueil / onboarding
│   ├── (auth)/                 ← flux d'authentification
│   │   ├── phone.tsx           ← saisie numéro de téléphone
│   │   ├── otp.tsx             ← vérification code SMS
│   │   ├── complete-profile.tsx ← saisie du nom
│   │   ├── set-pin.tsx         ← création du NIP (×2)
│   │   └── pin-login.tsx       ← connexion par NIP
│   ├── (client)/               ← onglets client
│   │   ├── _layout.tsx         ← navigation par onglets
│   │   ├── index.tsx           ← accueil (liste des commerces)
│   │   ├── search.tsx          ← recherche & filtres
│   │   ├── favorites.tsx       ← favoris
│   │   └── profile.tsx         ← profil client
│   ├── (pro)/                  ← espace professionnel
│   │   ├── _layout.tsx
│   │   ├── dashboard.tsx       ← tableau de bord analytics
│   │   ├── orders.tsx          ← gestion des commandes
│   │   ├── bookings.tsx        ← gestion des réservations
│   │   ├── profile.tsx         ← profil du commerce
│   │   └── register/           ← inscription commerce (5 étapes)
│   ├── business/
│   │   └── [id].tsx            ← page détail d'un commerce
│   ├── booking/
│   │   └── new.tsx             ← formulaire de réservation
│   ├── cart/
│   │   └── index.tsx           ← panier
│   ├── delivery/               ← choix + suivi livraison
│   ├── orders/
│   │   └── index.tsx           ← historique commandes
│   ├── catalog/                ← catalogue professionnel
│   └── notifications.tsx
│
├── components/                 ← composants réutilisables
│   ├── ui/                     ← composants de base
│   │   ├── Button.tsx          ← bouton primaire/secondaire
│   │   ├── Input.tsx           ← champ de saisie
│   │   ├── Badge.tsx           ← badge statut
│   │   ├── Card.tsx            ← carte générique
│   │   └── Avatar.tsx
│   ├── forms/
│   │   └── OTPInput.tsx        ← saisie code OTP / NIP
│   ├── business/
│   │   ├── BusinessCard.tsx    ← carte commerce (liste)
│   │   └── BusinessHeader.tsx  ← entête page commerce
│   ├── catalog/
│   │   └── CatalogItemCard.tsx ← carte article du catalogue
│   └── order/
│       ├── CartItem.tsx        ← ligne panier
│       └── DeliveryPicker.tsx  ← sélecteur mode livraison
│
├── hooks/                      ← hooks React personnalisés
│   ├── useAuth.ts              ← listener session Supabase
│   ├── useBusinesses.ts        ← liste des commerces
│   └── useColors.ts            ← tokens de design (dark/light)
│
├── stores/                     ← état global (Zustand)
│   ├── authStore.ts            ← session + profil utilisateur
│   └── cartStore.ts            ← panier
│
├── lib/
│   ├── supabase.ts             ← client Supabase + helpers auth
│   └── utils.ts                ← utilitaires (formatPrice, etc.)
│
├── types/
│   └── index.ts                ← types TypeScript partagés
│
├── constants/
│   └── Colors.ts               ← palette de couleurs
│
└── assets/
    └── images/
        ├── bymoh-logo.png      ← logo principal
        ├── icon.png            ← icône de l'app
        ├── illus_1/2/3.png     ← illustrations onboarding
        └── hero_banner.png     ← bannière accueil
```

---

## 9. Flux d'authentification

### Inscription (nouveau compte)

```
[Accueil]
  → "Créer un compte"
  → (auth)/phone.tsx  (mode=signup)
     ↓ sendOTP()
  → (auth)/otp.tsx
     ↓ verifyOTP() → session Supabase créée
  → (auth)/complete-profile.tsx
     ↓ INSERT INTO users ...
  → (auth)/set-pin.tsx
     ↓ supabase.auth.updateUser({ password: pin })
     ↓ UPDATE users SET pin_hash = 'configured'
  → (client)/  ✅
```

### Connexion (compte existant)

```
[Accueil]
  → "Se connecter"
  → (auth)/phone.tsx  (mode=login)
     ↓ checkPhoneExists() — vérifie dans users
     ├── Numéro inconnu → message d'erreur
     └── Numéro connu ↓
  → (auth)/pin-login.tsx
     ↓ signInWithPassword({ phone, password: pin })
  → (client)/  ✅
```

### AuthGuard (app/_layout.tsx)

Le composant `AuthGuard` s'exécute à chaque changement de route et applique ces règles :

| Condition | Redirection |
|---|---|
| Pas de session + route protégée | `/` (accueil) |
| Session + pas de profil | `/(auth)/complete-profile` |
| Session + profil + pas de NIP | `/(auth)/set-pin` |
| Session + profil + NIP + route auth/accueil | `/(client)` |

---

## 10. Modifier les éléments visuels

### 10.1 Couleurs (design tokens)

Les couleurs principales sont définies dans `constants/Colors.ts` et dans les fichiers eux-mêmes via des constantes.

| Couleur | Hex | Usage |
|---|---|---|
| **Orange primaire** | `#FF6835` | Boutons, accents, sélection active |
| **Navy secondaire** | `#1E3A5F` | Headers, boutons connexion |
| **Fond principal** | `#F8F7F4` | Background des écrans |
| **Rouge onboarding** | `#E84B1A` | Écran d'accueil / splash |
| **Texte principal** | `#111827` | Titres, labels |
| **Texte secondaire** | `#6B7280` | Sous-titres, placeholders |
| **Bordures** | `#E5E7EB` | Inputs, cartes |

Pour changer la couleur principale de l'app : chercher et remplacer `#FF6835` dans tout le projet.

### 10.2 Logo et images

| Fichier | Usage |
|---|---|
| `assets/images/bymoh-logo.png` | Logo (onboarding + splash screen) |
| `assets/images/icon.png` | Icône de l'app (App Store / Play Store) |
| `assets/images/illus_1.png` | Slide 1 onboarding |
| `assets/images/illus_2.png` | Slide 2 onboarding |
| `assets/images/illus_3.png` | Slide 3 onboarding |
| `assets/images/hero_banner.png` | Bannière page d'accueil client |

**Règle :** remplacer le fichier image en gardant le même nom, Expo rechargera automatiquement.

### 10.3 Nom et slug de l'app

Dans `app.json` :
```json
{
  "expo": {
    "name": "Bymoh",              ← nom affiché sur l'écran d'accueil téléphone
    "slug": "bymoh",              ← identifiant Expo (ne pas changer après publication)
    "scheme": "bymoh",            ← deep links (bymoh://)
    "ios": { "bundleIdentifier": "com.bymoh.app" },
    "android": { "package": "com.bymoh.app" }
  }
}
```

### 10.4 Textes de l'onboarding

Dans `app/index.tsx`, tableau `SLIDES` :
```tsx
const SLIDES = [
  { id: '1', title: 'Titre slide 1', subtitle: 'Sous-titre...', image: ... },
  { id: '2', title: 'Titre slide 2', subtitle: 'Sous-titre...', image: ... },
  { id: '3', title: 'Titre slide 3', subtitle: 'Sous-titre...', image: ... },
];
```

### 10.5 Catégories de commerces

Dans `hooks/useBusinesses.ts`, modifier le tableau des catégories affichées dans les filtres de recherche.

### 10.6 Villes et indicatifs téléphoniques

Dans `app/(auth)/phone.tsx`, tableau `COUNTRY_CODES` :
```tsx
const COUNTRY_CODES = [
  { code: '+225', flag: '🇨🇮', name: 'CI' },
  { code: '+228', flag: '🇹🇬', name: 'TG' },
  // Ajouter / supprimer des pays ici
];
```

---

## 11. Workflow Git & push GitHub

### 11.1 Configuration initiale (une seule fois)

```bash
git config --global user.name "Votre Nom"
git config --global user.email "votre@email.com"
```

### 11.2 Workflow quotidien

```bash
# 1. Récupérer les dernières modifications
git pull origin main

# 2. Créer une branche pour votre fonctionnalité
git checkout -b feat/nom-de-la-fonctionnalite

# 3. Faire vos modifications…

# 4. Vérifier que TypeScript compile toujours
pnpm run typecheck

# 5. Ajouter et commiter
git add .
git commit -m "feat: description courte de la modification"

# 6. Pousser la branche
git push origin feat/nom-de-la-fonctionnalite

# 7. Ouvrir une Pull Request sur GitHub
```

### 11.3 Conventions de commits

Utiliser le format **Conventional Commits** :

| Préfixe | Usage |
|---|---|
| `feat:` | Nouvelle fonctionnalité |
| `fix:` | Correction de bug |
| `style:` | Modification visuelle (pas de logique) |
| `refactor:` | Refactoring sans changement fonctionnel |
| `docs:` | Documentation |
| `chore:` | Maintenance (dépendances, config) |

### 11.4 Avant chaque commit

```bash
# Vérification TypeScript obligatoire
pnpm run typecheck

# Si des erreurs apparaissent, les corriger avant de commiter
```

---

## 12. Gotchas & pièges courants

### Padding top sur les écrans
```tsx
// Toujours utiliser ce pattern pour le padding top
const topPad = Platform.OS === 'web' ? 67 : insets.top + 8;
```

### Tables Supabase
- Table des utilisateurs : `users` (pas `profiles`)
- Table du catalogue : `services` (pas `catalog_items`)
- Les commandes n'ont **pas** de colonne `items` — utiliser la jointure `order_items`
- `delivery_method` (pas `delivery_type`)
- `user_id` dans bookings et orders (pas `client_id`)

### Champs importants à ne pas confondre
| Ancien (incorrect) | Correct |
|---|---|
| `catalog_item.name` | `service.title` |
| `business.delivery_available` | `business.has_delivery` |
| `business.status` | `business.is_active` + `business.is_verified` |
| `booking.time_slot` | `booking.time` |
| `order.items` (jsonb) | jointure `order_items` |

### Variables d'environnement manquantes
Si l'app affiche "placeholder.supabase.co" dans les erreurs → le fichier `.env` n'est pas chargé. Vérifier qu'il existe et redémarrer Metro (`r` dans le terminal).

### OTPInput pour le NIP
Le composant `OTPInput` est réutilisé pour le NIP. Passer `secureTextEntry={true}` pour masquer les chiffres.

### Auth : PIN non configuré
Si un utilisateur a une session active mais `pin_hash` est null dans la table `users`, l'AuthGuard le redirige vers `/(auth)/set-pin`. C'est le comportement attendu.

### Supabase Phone Auth
Pour que la connexion par NIP fonctionne (`signInWithPassword({ phone, password })`), le **Phone provider** doit être activé dans Supabase **ET** un fournisseur SMS doit être configuré (Twilio / Vonage).

---

## Contacts & ressources

| Ressource | Lien |
|---|---|
| Supabase Dashboard | [supabase.com](https://supabase.com) |
| Documentation Expo | [docs.expo.dev](https://docs.expo.dev) |
| Documentation expo-router | [expo.github.io/router](https://expo.github.io/router/docs) |
| Repo GitHub | [github.com/Randall-Clark/Bymoh](https://github.com/Randall-Clark/Bymoh) |
