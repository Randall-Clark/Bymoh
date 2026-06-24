# Bymoh

Marketplace mobile local (iOS/Android) permettant aux clients de trouver, réserver et commander auprès de commerces locaux, et aux professionnels de gérer leur business.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- App mobile: Expo (React Native), expo-router v6
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Storage: AsyncStorage (persistence locale)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/marketplace-app/` — app Expo (Bymoh)
  - `app/` — écrans (expo-router file-based routing)
  - `app/(tabs)/` — onglets client : Accueil, Recherche, Favoris, Profil
  - `app/auth/` — auth flow : phone → OTP → profile
  - `app/business/[id].tsx` — détail d'un business
  - `app/booking/new.tsx` — nouvelle réservation
  - `app/cart/index.tsx` — panier
  - `app/delivery/` — choix + tracking livraison
  - `app/orders/index.tsx` — historique commandes/réservations
  - `app/notifications.tsx` — notifications
  - `app/pro/` — espace professionnel (register, dashboard, catalog, orders, schedule)
  - `constants/` — types, colors, mockData
  - `context/` — AuthContext, CartContext
  - `components/` — composants réutilisables
  - `hooks/useColors.ts` — design tokens light/dark

## Architecture decisions

- Auth simulée (phone → OTP mock → AsyncStorage) sans backend pour le v1
- Multi-rôle : client (/(tabs)/) et professionnel (/pro/) dans la même app
- Livraison via Gozem / Yango / retrait sur place
- FCFA comme monnaie principale, villes togolaises (Lomé)
- Couleurs : orange primaire #FF6835, navy secondaire #1E3A5F, fond #F8F7F4

## Product

- Clients : chercher/filtrer par catégorie, voir les businesses, réserver des services, commander et se faire livrer, gérer son panier, suivre la livraison
- Professionnels : inscrire leur business (5 étapes), gérer le catalogue, les horaires, les commandes et le tableau de bord analytics

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `Platform.OS === "web" ? 67 : insets.top` — pattern pour le padding top sur web vs mobile
- Les écrans retournent `null` si `isLoading` est true (AuthContext init async)
- `app/_layout.tsx` wraps tout avec AuthProvider + CartProvider — indispensable
- NativeTabs (iOS 26 / liquid glass) + ClassicTabs (Android/web) dans `(tabs)/_layout.tsx`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
