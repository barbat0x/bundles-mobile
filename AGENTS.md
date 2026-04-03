# bundles.fi Mobile — Agent Instructions

## Project Overview

Mobile app for bundles.fi — users invest in DeFi index bundles via fiat. All crypto complexity is abstracted: social login, credit card, automatic swap. One user action, one on-chain transaction.

## Architecture Principle: Maximum Simplicity

Every dependency must earn its place. Fewer abstractions, fewer layers, fewer libraries. When in doubt, choose the simpler solution.

## Tech Stack (Minimal)

- **Framework**: React Native + Expo SDK 55+ (EAS Build for production)
- **Language**: TypeScript (strict)
- **Web3**: thirdweb TypeScript SDK v5 (TS-first; React hooks/components allowed when they reduce complexity and stay consistent)
- **Wallet**: thirdweb In-App Wallet EOA (non-custodial, social login)
- **Contract**: UniversalRouter on Ethereum mainnet (prod) + Avalanche Fuji (test env)
- **Routing SDK**: `@bundlesfi/universal-router` (quotes + calldata for buy/sell)
- **State**: Zustand (client) + TanStack Query (server/cache/polling)
- **Navigation**: Expo Router (file-based)
- **UI**: NativeWind (Tailwind utility classes for RN, aligned with web visual patterns)
- **On-ramp**: Transak (on-ramp enabled on Ethereum mainnet only, ~1% fee)
- **Data**: The Graph subgraph + API serveur bundles (prix) + Alchemy/Moralis (fallback)
- **Crash reporting**: Sentry

## MVP Scope (Mainnet + Testnet)

- 3 screens: Bundles (Discover), Trade (Buy/Sell), Portfolio.
- Buy: Transak delivers ETH (mainnet only) → `buyBundle()` SDK → `UniversalRouter.swapETHForExactTokens` (1 tx, no approve).
- Sell: `sellBundle()` SDK → ERC20 approve → `UniversalRouter.swapExactTokensForETH` (2 auto-signed txs).
- Verify `receipt.status` === success.
- No USDC, no paymaster, no bundler, no new app-owned backend, no second on-ramp provider.
- Chains policy: Ethereum mainnet for production; Avalanche Fuji allowed for test/preprod validation.
- Reuse `../bundles-frontend` patterns and `../universal-router` SDK.
- USDC support deferred to Phase 2.

## Key Architecture Decisions

Refer to `PLAN.md` for full rationale:

- **EOA over Smart Account**: simpler, cheaper, no infra overhead.
- **ETH on-ramp only (MVP)**: Transak uniquement sur Ethereum mainnet, zéro logique de fallback.
- **User-paid gas**: variable cost deducted from purchased ETH.
- **No new backend**: connects to existing `wss://api.bundles.fi/ws/` + The Graph + RPC.
- **OTA updates disabled in prod**: security requirement for crypto wallet.
- **Minimal dependencies**: every package must be justified.
- **Boundary rule**: `thirdweb/react-native` only for wallet/session UI; tx/quote/slippage logic stays in `services/**` TS modules.

## Critical PLAN.md Sections for Implementation

- **5.7** — UI spec par écran (composants, états, formats) — THE reference for building screens
- **5.8** — State machines (auth, trade Mode A, trade Mode B) — implement these exactly
- **6.3** — Contract addresses and ABIs
- **6.5** — Repo reuse details (`bundles-frontend` patterns, `universal-router` SDK)
- **6.7** — API Contracts (WebSocket, Graph, RPC, env vars)
- **10.3** — Testable done criteria

## Production Checklist

- Error boundary at root `_layout.tsx`.
- Splash screen via `expo-splash-screen`.
- Sentry for crash reporting (strip sensitive data).
- Deep linking for Transak return URL.
- EAS Build profiles: `development`, `preview`, `production`.
- `expo-secure-store` for sensitive data, `AsyncStorage` for non-secret state only.
- Network state handling for RPC / on-ramp failures.

## Official documentation & best practices (mandatory)

All changes must align with **authoritative** sources—not forum guesses alone.

| Area | Primary references |
|------|---------------------|
| **Expo / RN workflow** | [Expo docs](https://docs.expo.dev/) (SDK version pinned in `package.json`), [React Native docs](https://reactnative.dev/docs/getting-started) |
| **Android / Gradle** | [Android Developers](https://developer.android.com/), [Gradle User Manual](https://docs.gradle.org/current/userguide/userguide.html) |
| **EAS** | [EAS Build / Submit](https://docs.expo.dev/build/introduction/) |
| **thirdweb** | [thirdweb TypeScript v5](https://portal.thirdweb.com/typescript/v5) |
| **Patches to `node_modules`** | Prefer upstream fix or upgrade; if blocked, use [`patch-package`](https://github.com/ds300/patch-package) with **`patches/*.patch` committed**, and document in `docs/TROUBLESHOOTING.md` with **symptom → root cause → official rationale** (e.g. Gradle deprecations from Gradle’s own upgrading guides) |

**Rules for agents & contributors**

1. Prefer behavior described in **official docs** over ad-hoc patterns from blogs/Stack Overflow unless the latter **cites** the same primary source.
2. When fixing toolchain issues (Gradle, ADB, emulator, 16 KB), cross-check **Android / Gradle / Expo** documentation and record the **verification command** (see `docs/TROUBLESHOOTING.md`).
3. New dependencies must be **justified** (see *Maximum Simplicity* above) and pinned consistently with Expo’s recommendations (`npx expo install` where applicable).

## Critical Security Rules

1. ONLY interact with whitelisted contract addresses (`lib/contracts.ts`).
2. Never log private keys or full wallet addresses in production.
3. Validate all amounts and check `receipt.status` before confirming.
4. Pinned versions + periodic `npm audit` + strict lockfile.
5. Use `/security-auditor` for any code touching wallet, transactions, or payments.

## Subagents

- `/verifier` — Validate completed work actually functions.
- `/debugger` — Root cause analysis for errors and crashes.
- `/security-auditor` — Security review for sensitive code paths.
