# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Contains a backend API server and a React Native (Expo) mobile app called MatchA.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Mobile**: Expo (SDK 54), Expo Router v6

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── matcha-app/         # MatchA Expo mobile app
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## MatchA App — Mobile App

**MatchA** is a self-improvement mobile app for single men (27–38) who want to improve their dating prospects.

### App Structure

- **4 functional views**: Login, Profile, Discover, My Goals
- **3 tabs**: Discover, Profile, My Goals
- **Bilingual**: Spanish (primary), English (secondary) with i18n architecture

### Key Files (matcha-app)

- `app/_layout.tsx` — Root layout with providers (SafeAreaProvider, QueryClient, AppProvider)
- `app/index.tsx` — Entry redirect (login vs tabs based on auth state)
- `app/login.tsx` — Premium login screen with animated branding
- `app/(tabs)/_layout.tsx` — Tab bar with NativeTabs (liquid glass iOS 26+) + ClassicTabs fallback
- `app/(tabs)/discover.tsx` — Card-stack swipe screen with like/dislike states
- `app/(tabs)/profile.tsx` — Editable profile with photo grid, dropdowns, interest chips
- `app/(tabs)/goals.tsx` — Progress dashboard with animated goal cards
- `constants/colors.ts` — Navy/gold/ivory premium color system
- `constants/i18n.ts` — Full Spanish + English translations
- `context/AppContext.tsx` — Auth state, language, profile with AsyncStorage persistence

### Design System

- **Primary color**: Navy (#0D1B2A)
- **Accent**: Gold (#C9A84C)
- **Text**: Ivory (#F5F0E8)
- **Font**: Inter (400, 500, 600, 700)
- **Card style**: Dark navy cards (#162030) with subtle borders
- **Theme**: Masculine, minimalist, premium, aspirational

### Features

- Swipeable profile cards (Tinder-style) with like/dislike overlays
- Animated progress bars (Reanimated)
- Category-filtered goals list
- Photo grid (up to 10 slots)
- Physical attribute dropdowns
- Interest tag multi-select
- Language toggle (ES/EN)
- Haptic feedback on key interactions
- Device language auto-detection ready
