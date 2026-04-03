# bundles.fi mobile

Expo / React Native app for investing in DeFi index bundles via fiat (thirdweb In-App Wallet, Transak on-ramp, `@bundlesfi/universal-router`). **TypeScript strict**, **Expo SDK 55+**, **Expo Router**.

**Troubleshooting:** [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) — start with **High-friction local setup** for the hardest local setup issues.

## Stack (one line)

Expo SDK 55 · React Native 0.83 · NativeWind · TanStack Query · Zustand · thirdweb v5 · viem. Deeper product/architecture notes may live in local-only files (e.g. Cursor); not duplicated in this repo.

## Prerequisites


| Tool         | Notes                                                            |
| ------------ | ---------------------------------------------------------------- |
| **Node.js**  | **22.x** recommended (see `.nvmrc`; `engines` in `package.json`) |
| **npm**      | **10+**                                                          |
| **Expo CLI** | Via `npx expo` (no global install required)                      |
| **Android**  | Android Studio + SDK (emulator or device) for native builds      |
| **iOS**      | Xcode + Simulator (**macOS only**)                               |
| **EAS CLI**  | Optional: `npm i -g eas-cli` for cloud builds                    |


## Installation

```bash
git clone <repository-url>
cd bundles-fi-mobile
npm ci
cp .env.example .env
# Edit .env — see table below
```

### `@bundlesfi/universal-router`

The app consumes a **versioned tarball** under `vendor/bundlesfi-universal-router-*.tgz` (includes `dist/`). A Git-only checkout of the router repo is **not** enough for Metro — see [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) if you need to regenerate the package.

## Environment variables

Copy `.env.example` to `.env`. All public app config uses the `EXPO_PUBLIC_`* prefix (embedded in the client bundle — **no secrets**).


| Variable                                | Required    | Description                                                                           |
| --------------------------------------- | ----------- | ------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_THIRDWEB_CLIENT_ID`        | **Yes**     | thirdweb client ID                                                                    |
| `EXPO_PUBLIC_GRAPH_API_KEY`             | **Yes**     | The Graph / gateway key                                                               |
| `EXPO_PUBLIC_API_WS_ENDPOINT`           | No*         | Bundles WS API (default in example: `wss://api.bundles.fi/ws/`)                       |
| `EXPO_PUBLIC_RPC_FALLBACK_URL`          | No*         | RPC fallback (default in example)                                                     |
| `EXPO_PUBLIC_SENTRY_DSN`                | No          | Sentry DSN (public)                                                                   |
| `EXPO_PUBLIC_TRANSAK_API_KEY`           | For on-ramp | Transak API key                                                                       |
| `EXPO_PUBLIC_THIRDWEB_PAY_TEST_MODE`    | No          | `true` = thirdweb Pay / Transak **test** mode — **never `true` for store production** |
| `EXPO_PUBLIC_ONRAMP_COUNTRY`            | No          | ISO2 on-ramp country (e.g. `FR`)                                                      |
| `EXPO_PUBLIC_ALCHEMY_API_KEY`           | No          | Optional RPC / pricing fallback                                                       |
| `EXPO_PUBLIC_DEV_BYPASS_PORTFOLIO_AUTH` | No          | Dev-only portfolio gate bypass                                                        |


Has defaults in `.env.example`; set explicitly if your environment differs.

## npm scripts


| Script      | Command                                |
| ----------- | -------------------------------------- |
| Start Metro | `npm start` → `expo start`             |
| Android     | `npm run android` → `expo run:android` |
| iOS         | `npm run ios` → `expo run:ios`         |
| Web         | `npm run web` → `expo start --web`     |
| Typecheck   | `npm run typecheck`                    |
| Lint        | `npm run lint`                         |
| Test        | `npm run test`                         |


## Run locally

Default dev server port in this repo is often **8082** (avoid collisions):

```bash
npx expo start --port 8082
```

Then press `a` (Android), `i` (iOS), or scan QR for **Expo Go** (when compatible).

```bash
npm run android
npm run ios
npm run web
```

## EAS Build

Profiles are defined in [eas.json](eas.json): **development** (dev client), **preview**, **production**. Android builds use the **sdk-55** image unless overridden. See [EAS Build](https://docs.expo.dev/build/introduction/) and [eas.json](https://docs.expo.dev/eas/json/eas-json/).

```bash
eas build -p android --profile preview
```

## Quality gates

```bash
npm run typecheck
npm run lint
npm test
```

## Security

- Do **not** commit `.env`, keystores, or private keys.
- Contract addresses stay in [lib/contracts.ts](lib/contracts.ts) (whitelist only).

## Branding / UI (short)

Light theme aligned with **bundles-frontend**; UI primitives under `components/ui/`, tokens in `lib/ui-tokens.ts` and `tailwind.config.js`.

## Thirdweb Pay (fiat test)

`EXPO_PUBLIC_THIRDWEB_PAY_TEST_MODE=true` enables test/staging fiat flows — **not** for production store builds. (Optional E2E notes may exist locally under `docs/` — not part of the tracked docs set.)

## More documentation

This repository intentionally tracks **this README** and **[docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)** only. Other Markdown (architecture notes, parity reports, `AGENTS`, `PLAN`, etc.) can live **locally** for Cursor or internal use — use `git add -f <file>` if you ever need to push an exception.


