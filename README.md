# bundles-fi-mobile

Application mobile Expo/React Native pour acheter/vendre des bundles via `@bundlesfi/universal-router`.

## Branding / UI

- Aligné sur `**bundles-frontend**` en **thème clair uniquement** (pas de `dark:` — équivalent du mode Day / défaut sur le web).
- **Primitives** (`components/ui/`): `BundlesButton` (variants primary/secondary/…, `rounded-full`), `BundlesTextInput`, `BundlesCard`, `BundlesSegmented` (radio-group / tabs).
- Tokens: `lib/ui-tokens.ts` + classes Tailwind `bundle.*` (`tailwind.config.js`).

## Thirdweb Pay — fiat (test)

- Variable `**EXPO_PUBLIC_THIRDWEB_PAY_TEST_MODE`** : `true` active `isTestMode` sur `[getBuyWithFiatQuote](https://portal.thirdweb.com/references/typescript/v5/getBuyWithFiatQuote)` (fournisseur en **staging**, ex. cartes test Transak — pas de débit réel).
- **Ne jamais** mettre `true` en build production / store.
- Parcours **fiat → ETH → bundle** (Carte / Ethereum) : voir `**[docs/E2E-TESTING.md](docs/E2E-TESTING.md)`**.
- Cartes / règles Transak : [Test credentials](https://docs.transak.com/docs/test-credentials).

## Multi-chain (switch in-app)

- L'app est maintenant config-driven par réseau (`lib/chains.ts`) avec:
  - contrats protocol par chain,
  - subgraph id The Graph par chain,
  - metadata explorer/symbole natif.
- Le réseau actif est persistant (`store/network-store.ts`) et sélectionnable dans l'UI via `NetworkSwitch`.
- Les flux data + trade utilisent ce réseau actif:
  - GraphQL,
  - WebSocket pricing/history,
  - public client viem,
  - chain thirdweb pour wallet balance/transactions.

## Prerequisites

- Node.js 20+
- npm 10+
- Expo CLI (via `npx expo ...`)
- Optionnel pour device:
  - iOS: Xcode + Simulator (macOS)
  - Android: Android Studio + emulator
  - ou Expo Go sur téléphone
- Pour **régénérer** le paquet router : clone/build du repo `universal-router`, puis `npm pack` vers `vendor/` (voir `TROUBLESHOOTING.md`).
- `@bundlesfi/universal-router` est consommé via `**vendor/bundlesfi-universal-router-*.tgz`** (contient `dist/`) — pas via `file:../` ni Git seul.

## Installation locale

1. Installer les dépendances:

```bash
npm install
```

1. Créer le fichier d'environnement:

```bash
cp .env.example .env
```

1. Renseigner les variables minimum dans `.env`:

- `EXPO_PUBLIC_THIRDWEB_CLIENT_ID`
- `EXPO_PUBLIC_GRAPH_API_KEY`
- `EXPO_PUBLIC_API_WS_ENDPOINT` (par défaut `wss://api.bundles.fi/ws/`)
- `EXPO_PUBLIC_RPC_FALLBACK_URL` (par défaut `https://0xrpc.io/eth`)

## Lancement local

### Démarrer Metro

```bash
npx expo start --port 8082  --web
```

Puis:

- `a` pour Android emulator
- `i` pour iOS simulator
- scanner le QR code avec Expo Go

### Raccourcis scripts

```bash
npx expo start --port 8082  --web
npm run android
npm run ios
npm run web
```

## Vérifications qualité

```bash
npm run typecheck
npm run lint
npm test
```

## Troubleshooting

- See `TROUBLESHOOTING.md` for recurring setup/runtime issues and fixes.
- Current known issues documented:
  - Linux/WSL missing `libasound.so.2` for RN DevTools
  - Expo SDK dependency version drift warnings
  - The Graph gateway auth URL format

## Notes importantes

- Le projet utilise Expo Router (`expo-router/entry`).
- OTA updates sont désactivées en production dans `app.json`.
- L'on-ramp est via thirdweb Pay avec provider Transak.
- Le mode one-click all est implémenté en auto-swap Mode A (trigger après détection des fonds + reprise via intent persistant).
- `@bundlesfi/universal-router` : **tarball versionné** sous `vendor/bundlesfi-universal-router-0.0.12.tgz` (généré avec `npm run build` + `npm pack` dans le repo router — voir `TROUBLESHOOTING.md`). Une install **Git seule** ne fournit pas `dist/`, donc Metro échoue.

