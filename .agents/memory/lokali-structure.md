---
name: Lokali app structure
description: Key conventions and architecture decisions for the Lokali mobile marketplace (Expo)
---

# Lokali – Architecture & conventions

## Auth pattern
- `AuthContext` wraps the whole app via `_layout.tsx`. During init, `isLoading=true` → screens return `null`.
- Welcome screen (`app/index.tsx`) redirects authenticated users to `/(tabs)` via `router.replace`.
- Auth flow: `/auth/phone` → `/auth/otp` → `/auth/profile` → `/(tabs)`

## Platform padding pattern
All screens use: `const topPad = Platform.OS === "web" ? 67 : insets.top`

## Colors
`hooks/useColors.ts` returns `colors.light` by default. All tokens (primary, secondary, muted, etc.) come from `constants/colors.ts`.

## Routing structure
- `/(tabs)/` — client tabs (index, search, favorites, profile)
- `/auth/` — auth flow
- `/business/[id]` — business detail
- `/booking/new` — reservation booking
- `/cart/`, `/delivery/`, `/orders/` — commerce flow
- `/pro/` — professional space (register, dashboard, catalog, orders, schedule)

**Why:** File-based routing with expo-router v6. All screens registered explicitly in `app/_layout.tsx` Stack.

## Data
- AsyncStorage for all persistence in v1 (no real backend)
- Currency: FCFA, main city: Lomé, Togo
- `constants/mockData.ts` exports: MOCK_BUSINESSES, MOCK_BOOKINGS, MOCK_ORDERS, CATEGORIES, TIME_SLOTS, formatPrice, formatDate
