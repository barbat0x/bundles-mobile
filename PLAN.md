# bundles.fi — Plan Architecture Application Mobile

## Sommaire

1. [Vision & Objectif](#1-vision--objectif)
2. [Stack Technologique](#2-stack-technologique)
3. [Architecture Wallet & Transactions](#3-architecture-wallet--transactions)
4. [Fiat On-Ramp — Analyse Comparative](#4-fiat-on-ramp--analyse-comparative)
5. [Flow Utilisateur Cible](#5-flow-utilisateur-cible)
6. [Architecture Technique Détaillée](#6-architecture-technique-détaillée)
7. [App Store — Conformité Réglementaire](#7-app-store--conformité-réglementaire)
8. [Audit Externe — Challenges & Risques](#8-audit-externe--challenges--risques)
9. [Roadmap de Développement](#9-roadmap-de-développement)

---

## 1. Vision & Objectif

**Mot d'ordre** : L'utilisateur télécharge l'app, se connecte avec Google/Apple, achète un Bundle en carte bleue. 3 étapes, zéro notion de wallet, seed, gas, ETH.

**Flux actuel (navigateur)** :

```
Installer MetaMask → Créer wallet → Sauvegarder seed → Acheter ETH via CB →
Attendre réception → Aller sur bundles.fi → Approuver token → Swap → Recevoir Bundle
```

= ~8 étapes, 3 apps, connaissance crypto requise

**Flux cible (app mobile)** :

```
Ouvrir l'app → Se connecter (Google/Apple/email) → Choisir un Bundle →
Payer en CB → Recevoir le Bundle
```

= 4 étapes, 1 app, zéro connaissance crypto requise

---

## 2. Stack Technologique

### Analyse des leaders du marché


| App                      | Framework               | Langage principal  | Notes                                                                   |
| ------------------------ | ----------------------- | ------------------ | ----------------------------------------------------------------------- |
| **Uniswap Wallet**       | React Native            | TypeScript (91.5%) | Open-source GPL-3.0, repo archivé → migré vers interface monorepo       |
| **Aave** (officiel 2026) | iOS natif (Swift/UIKit) | Swift              | Recrutent Staff iOS Engineer, ancienne version communautaire en Flutter |
| **Rainbow Wallet**       | React Native            | TypeScript         | Open-source, très populaire                                             |
| **Coinbase Wallet**      | React Native            | TypeScript         | Intégration deep avec Coinbase onramp                                   |


### Recommandation : React Native (Expo) + TypeScript

**Pourquoi React Native Expo et pas les autres options :**


| Option                | Verdict    | Raison                                                                                                                                                 |
| --------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **React Native Expo** | **RETENU** | Écosystème web3 le plus mature (thirdweb, wagmi, viem ont tous des SDK RN), hot reload, OTA updates via EAS, même langage que le frontend web existant |
| Flutter               | Écarté     | Écosystème web3 Dart très limité, peu de SDK DeFi natifs, obligation de wrapper toutes les libs JS                                                     |
| NativeScript          | Écarté     | Communauté trop petite, quasi zéro tooling web3                                                                                                        |
| Vue.js + Capacitor    | Écarté     | Performance inférieure pour une app financière, WebView = pas natif, problèmes de sécurité pour le key management                                      |
| Swift/Kotlin natif    | Écarté     | Double codebase = 2x le coût de dev, pas de SDK web3 matures en natif                                                                                  |


**Stack finale :**

- **Framework** : React Native avec Expo (SDK 55+)
- **Langage** : TypeScript
- **Web3 SDK** : thirdweb TypeScript SDK v5 (TS-first, hooks/components React autorisés si cela simplifie)
- **Wallet** : thirdweb In-App Wallet EOA (embedded, non-custodial, pas de smart account)
- **Smart Contract** : UniversalRouter (`0x1751F0eADFeB3d618B9e4176edDC9E7D24657c00`) — contrat d'entrée unique pour buy/sell via `@bundlesfi/universal-router` SDK (mainnet prod + Fuji test env)
- **State Management** : Zustand (client state uniquement) + TanStack Query (server state, cache, polling)
- **Navigation** : Expo Router (file-based routing)
- **UI** : NativeWind (TailwindCSS pour RN, cohérent avec les patterns visuels web)

---

## 3. Architecture Wallet & Transactions

### Le problème fondamental

L'utilisateur moyen ne sait pas ce qu'est :

- Un wallet / une adresse Ethereum
- Une seed phrase / clé privée
- Du gas / des frais de transaction
- Un approve + swap (2 transactions)

Il faut **tout abstraire**.

### Décision 1 : EOA simple vs ERC-4337 Smart Account


| Critère                         | EOA simple (wallet embedded)                                        | ERC-4337 Smart Account                                         |
| ------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Gas par achat (ETH)**         | **~$0.02-0.39** (1 tx standard)                                     | ~$0.05-1.00 (UserOp, 2-3x overhead)                            |
| **Coût 1er usage**              | **$0**                                                              | $1-5 (déploiement du smart account on-chain)                   |
| **Actions utilisateur**         | **1 (payer CB)**                                                    | 1 (payer CB) — identique                                       |
| **Batch approve+swap**          | Pas nécessaire pour buy (UniversalRouter accepte ETH nativement, pas d'approve). Sell: 1 approve + 1 swap, auto-signés | Oui (1 UserOp) |
| **Signature sans popup**        | **Oui** (wallet embedded = clé dans l'app)                          | Oui                                                            |
| **Session keys (DCA auto)**     | Non (ajout possible en upgradeant vers AA plus tard)                | Oui                                                            |
| **Gas sponsorship (paymaster)** | Non                                                                 | Oui                                                            |
| **Dépendances infra**           | **Aucune** (juste RPC Ethereum)                                     | Bundler + EntryPoint + éventuellement Paymaster                |
| **Complexité code**             | **Faible** (sendTransaction standard)                               | Élevée (UserOperation, bundler API, EntryPoint)                |
| **Compatibilité écosystème**    | **Totale** (EOA = standard Ethereum)                                | Bonne mais certains dApps ne supportent pas les smart accounts |
| **Récupération du wallet**      | **Login social** (clé shardée thirdweb)                             | Login social (identique)                                       |
| **Export clé privée**           | **Oui**                                                             | Oui (mais l'EOA signer, pas le smart account)                  |


**Verdict : EOA simple.**

L'ERC-4337 n'apporte rien pour notre use case actuel :

- Le batch n'est pas nécessaire pour le buy grâce au UniversalRouter qui accepte l'ETH directement (1 seule tx, zéro approve). Le sell fait approve + swap, auto-signés par le wallet embedded
- Le gas sponsorship (paymaster) est écarté — l'utilisateur paie son propre gas (~0.03-0.6% du montant, négligeable)
- Les session keys ne sont pas nécessaires au MVP
- L'UX est strictement identique : l'utilisateur ne voit qu'une seule action (payer par CB)

Si un jour on a besoin de DCA automatique (session keys) ou d'autres features AA, on pourra upgrader le wallet vers un smart account sans changer l'UX. Mais pour le lancement, ça ajoute de la complexité et du coût pour zéro bénéfice.

### Décision 2 : Gas sponsorship (Paymaster) vs User-paid gas


| Critère                     | Paymaster (bundles.fi paie le gas)                                                   | User-paid (gas déduit de l'achat)                            |
| --------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| **Coût pour bundles.fi**    | ~$0.02-1.00 par tx (on paie le gas de chaque utilisateur)                            | **$0**                                                       |
| **Coût pour l'utilisateur** | $0 visible                                                                           | **~$0.02-0.60** déduit de l'ETH acheté (~0.03-0.6% sur 100€) |
| **Infra requise**           | Paymaster contract + dépôt ETH + monitoring du solde + thirdweb markup 10%           | **Aucune**                                                   |
| **Scaling**                 | Coût proportionnel au nombre d'utilisateurs (1000 users × 5 achats = $100-5000/mois) | **$0 quel que soit le volume**                               |
| **Risque**                  | Paymaster à sec = txs bloquées pour tous les utilisateurs                            | **Aucun** — chaque user a son propre ETH                     |
| **Complexité**              | Élevée (config paymaster, sponsorship rules, monitoring balance, alerts)             | **Zéro**                                                     |
| **UX**                      | "Zéro frais" (marketing)                                                             | "Frais réseau : $0.15" (transparent, honnête)                |


**Verdict : User-paid gas.**

Sur Ethereum L1 en 2026, le gas est devenu quasi-gratuit (~0.037 Gwei moyen). Un swap coûte $0.02-0.39. Pour un achat de 100€, c'est ~0.03-0.4% — l'utilisateur ne le remarque même pas. Sponsoriser le gas ajouterait :

- Un coût récurrent proportionnel au nombre d'utilisateurs
- Un risque opérationnel (paymaster à sec = app en panne)
- De la complexité technique (contrat paymaster, monitoring, recharges)
- Un markup de 10% par thirdweb sur chaque tx sponsorisée

Tout ça pour économiser $0.15 à l'utilisateur sur un achat de 100€. Le ratio effort/bénéfice ne justifie pas le paymaster.

L'approche transparente ("Frais réseau : $0.15") est aussi plus honnête qu'un "0 frais" qui cache le coût dans les marges.

---

### Solution retenue : thirdweb In-App Wallet (EOA) + UniversalRouter

#### 3.1 Création du wallet (invisible pour l'utilisateur)

```
Utilisateur clique "Se connecter avec Google"
         ↓
thirdweb crée un In-App Wallet EOA (embedded, non-custodial)
         ↓
La clé privée est shardée (split en 2 parties) :
  - Device share (stocké sur le téléphone, Secure Enclave)
  - Auth share (chiffré, lié au compte Google/Apple)
         ↓
L'utilisateur a un wallet Ethereum sans le savoir
Pas de smart account à déployer → $0 de coût initial
```

**Avantages :**

- Aucune seed phrase à gérer
- Récupération via le même login social (perdu le tel → reconnexion Google → wallet retrouvé)
- Non-custodial : ni toi ni thirdweb n'avez accès aux fonds
- Export de la clé privée possible (settings avancés pour les power users)
- Wallet EOA standard = compatible avec tout l'écosystème Ethereum

#### 3.2 Flow technique détaillé : Achat CB → Bundle Token en 1 action

##### Scénario A : On-ramp en ETH (Transak via thirdweb Payments)

```
UTILISATEUR (visible)                    APP (invisible, auto-signé)
─────────────────────                    ───────────────────────────

1. Choisit "DeFi5 Bundle, 100€"
2. Tape "Payer par CB"
3. Widget on-ramp s'ouvre
4. Entre sa CB ou Apple Pay
5. Confirme le paiement
                                         6. On-ramp convertit 100€ → ETH
                                         7. ETH envoyé au wallet EOA
                                         8. App poll le balance (toutes les 5s)
                                         9. ETH détecté !
                                         10. App auto-signe 1 SEULE tx :
                                             UniversalRouter.swapETHForExactTokens{
                                               value: ethAmount + slippage
                                             }(bundleAddr, amount, calldata, deadline)
                                             → Calldata calculé par @bundlesfi/universal-router SDK
                                             → PAS d'approve (c'est de l'ETH)
                                             → Le router route via multi-DEX + mint Bundle Token
                                             → Gas : ~$0.02-0.39
                                         11. Bundle Token reçu dans le wallet

6. Voit "Achat confirmé ! 0.5 DeFi5"
```

**1 action utilisateur. 1 transaction on-chain (buy). Zéro popup de signature.** (Sell = 2 txs auto-signées : approve + swap)

##### Implémentation TypeScript de référence (basée sur `bundles-frontend` + `universal-router`)

Le code mobile réutilise le SDK `@bundlesfi/universal-router` (même lib que le frontend web).

**Sémantique des montants (critique)** :
- `buyBundle(client, bundleAddr, desiredBundleAmount)` → exact-out : "je veux X tokens, combien d'ETH ?"
- `sellBundle(client, bundleAddr, bundleAmountToSell)` → exact-in : "je vends X tokens, combien d'ETH je reçois ?"
- L'input utilisateur est **toujours en Bundle Tokens** (ou en EUR converti en estimation tokens pour Mode A CB).

```typescript
// lib/contracts.ts — fichier unique pour toutes les adresses
import type { Address } from "viem";

export const CONTRACTS = {
  universalRouter: "0x1751F0eADFeB3d618B9e4176edDC9E7D24657c00" as Address,
  factory: "0x209bE93480e23CA0876d5f9D6fbBD61490173f04" as Address,
  weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as Address,
} as const;

export const SLIPPAGE_BPS = 100n; // 1%
export const TX_DEADLINE_SECONDS = 300; // 5 min
```

```typescript
// lib/trade.ts — BUY (ETH → Bundle Token)
import { createPublicClient, http, encodeFunctionData } from "viem";
import { mainnet } from "viem/chains";
import { buyBundle, universalRouterAbi } from "@bundlesfi/universal-router";
import { createThirdwebClient } from "thirdweb";
import { sendTransaction, waitForReceipt } from "thirdweb";
import { CONTRACTS, SLIPPAGE_BPS, TX_DEADLINE_SECONDS } from "./contracts";
import type { Account } from "thirdweb/wallets";
import type { Address } from "viem";

const thirdwebClient = createThirdwebClient({ clientId: process.env.EXPO_PUBLIC_THIRDWEB_CLIENT_ID! });
const publicClient = createPublicClient({ chain: mainnet, transport: http("https://0xrpc.io/eth") });

export async function executeBuy(account: Account, bundleAddress: Address, desiredBundleAmount: bigint) {
  // 1. Quote : combien d'ETH pour obtenir desiredBundleAmount de bundle tokens ?
  const quote = await buyBundle(publicClient, bundleAddress, desiredBundleAmount, {
    deadline: TX_DEADLINE_SECONDS,
  });

  // 2. Slippage : envoyer plus d'ETH que nécessaire (excédent remboursé par le contrat)
  const ethWithSlippage = quote.ethCost + (quote.ethCost * SLIPPAGE_BPS) / 10000n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + TX_DEADLINE_SECONDS);

  // 3. Envoyer la transaction
  const result = await sendTransaction({
    account,
    transaction: {
      to: CONTRACTS.universalRouter,
      value: ethWithSlippage,
      data: encodeFunctionData({
        abi: universalRouterAbi,
        functionName: "swapETHForExactTokens",
        args: [bundleAddress, desiredBundleAmount, quote.calldata, deadline],
      }),
    },
  });

  // 4. Vérifier le receipt
  const receipt = await waitForReceipt({
    client: thirdwebClient,
    chain: mainnet,
    transactionHash: result.transactionHash,
  });
  if (receipt.status !== "success") throw new Error("Buy transaction reverted");

  return receipt;
}
```

```typescript
// lib/trade.ts — SELL (Bundle Token → ETH)
import { sellBundle } from "@bundlesfi/universal-router";

export async function executeSell(account: Account, bundleAddress: Address, bundleAmountToSell: bigint) {
  // 1. Approve ERC20 : autoriser le UniversalRouter à dépenser les bundle tokens
  // (utiliser prepareContractCall thirdweb pour l'approve standard ERC20)
  await approveIfNeeded(account, bundleAddress, CONTRACTS.universalRouter, bundleAmountToSell);

  // 2. Quote : combien d'ETH pour vendre bundleAmountToSell tokens ?
  const quote = await sellBundle(publicClient, bundleAddress, bundleAmountToSell, {
    deadline: TX_DEADLINE_SECONDS,
  });

  // 3. Slippage : accepter un peu moins d'ETH que la quote
  const minEthOut = quote.ethProceeds - (quote.ethProceeds * SLIPPAGE_BPS) / 10000n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + TX_DEADLINE_SECONDS);

  // 4. Envoyer la transaction
  const result = await sendTransaction({
    account,
    transaction: {
      to: CONTRACTS.universalRouter,
      value: 0n,
      data: encodeFunctionData({
        abi: universalRouterAbi,
        functionName: "swapExactTokensForETH",
        args: [bundleAddress, bundleAmountToSell, minEthOut, quote.calldata, deadline],
      }),
    },
  });

  // 5. Vérifier le receipt
  const receipt = await waitForReceipt({
    client: thirdwebClient,
    chain: mainnet,
    transactionHash: result.transactionHash,
  });
  if (receipt.status !== "success") throw new Error("Sell transaction reverted");

  return receipt;
}
```

**Points clés :**
- **Buy** : `swapETHForExactTokens` (payable, 1 tx, zéro approve car c'est de l'ETH natif)
- **Sell** : `swapExactTokensForETH` (2 txs auto-signées : 1 approve ERC20 + 1 swap)
- **Slippage** : appliqué côté app. Le SDK retourne les montants bruts, l'app ajoute/retire le buffer
- **Calldata** : le SDK agrège multi-DEX (Uniswap V2/V3/V4, Bundles Swap, etc.) et retourne le calldata prêt
- **Toutes les adresses** dans `lib/contracts.ts`, jamais de hardcoded inline

#### 3.3 Pourquoi le wallet embedded rend tout ça possible

Avec MetaMask ou un wallet externe, chaque `sendTransaction` déclenche un popup
de confirmation → l'utilisateur doit approuver manuellement chaque tx.

Avec le **wallet embedded thirdweb**, la clé privée vit dans l'app (shardée, Secure Enclave).
L'app signe les transactions **programmatiquement**, sans popup, sans interruption.
L'utilisateur a donné sa confiance en se connectant avec Google — toutes les signatures
sont silencieuses après ça.

C'est ce qui permet de faire tourner 1 transaction on-chain tout en ne demandant
qu'une seule action à l'utilisateur (le paiement CB).

---

## 4. Fiat On-Ramp — Analyse Comparative

### Comparaison détaillée


| Provider            | Frais CB       | Pays couverts      | KYC requis                 | Intégration     | Paiements supportés                 | Notes                                           |
| ------------------- | -------------- | ------------------ | -------------------------- | --------------- | ----------------------------------- | ----------------------------------------------- |
| **Coinbase Onramp** | ~1-2%          | US + pays Coinbase | Compte Coinbase ou minimal | SDK + API       | CB, virement, Apple Pay             | Fallback robuste en on-ramp ETH                 |
| **Ramp Network**    | 0.49-2.9%      | 150+ pays          | Oui                        | SDK gratuit     | CB, virement, Apple Pay, Google Pay | Intégration gratuite, bons frais                |
| **Transak**         | ~1% + variable | 162 pays           | Oui (réutilisable)         | SDK (React/Vue) | CB, PIX, UPI, SPEI, virement        | Partenaire exclusif MetaMask                    |
| **MoonPay**         | 1-4.5%         | 180 pays           | Oui                        | Widget/SDK/API  | CB, virement, Apple Pay, PayPal     | Le plus connu, frais les plus élevés            |
| **Mt Pelerin**      | ~1.3%          | Suisse + EU        | Minimal / anonyme          | Widget          | CB, virement SEPA                   | Basé en Suisse, pas de KYC sous certains seuils |


### Recommandation : Transak (ETH) uniquement pour le MVP

> Scope MVP verrouillé : on-ramp ETH uniquement via Transak, activé sur Ethereum mainnet (prod). Un seul provider, zéro logique de fallback côté app.

**Configuration MVP :**

1. **Transak** uniquement (162 pays, ~1%, on-ramp en ETH direct)

Intégration via thirdweb Payments (Transak configuré comme seul provider actif).
Coinbase Onramp pourra être ajouté en Phase 2 via la config thirdweb Payments (zéro code app à changer).

**Pas besoin de créer de société pour la passerelle** : thirdweb, Transak, et Ramp Network gèrent toute la compliance KYC/AML côté provider. Tu intègres leur SDK, ils s'occupent du reste. L'utilisateur fait son KYC avec le provider, pas avec toi.

### Scénario optimal pour les frais


| Méthode            | Frais estimés sur 100€                          |
| ------------------ | ----------------------------------------------- |
| Via Transak (ETH)  | ~~1€ frais on-ramp + ~$0.15 gas = **~~1.30€**   |
| Via Coinbase (ETH) — Phase 2 | ~~1-2€ frais on-ramp + ~$0.15 gas = **~~1.80€** |
| MetaMask actuel    | ~~4.5€ frais CB + ~$2 gas = **~~6.50€**         |


**Réduction de frais : de ~6.50€ à ~1.30€** (amélioration de ~80%).

---

## 5. Flow Utilisateur Cible

### 5.1 Premier lancement (nouvel utilisateur)

```
┌─────────────────────────────────────────┐
│           ÉCRAN DE BIENVENUE            │
│                                         │
│   "Investissez dans les meilleurs       │
│    protocoles DeFi en un clic"          │
│                                         │
│   [Continuer avec Google]               │
│   [Continuer avec Apple]                │
│   [Continuer avec Email]                │
│                                         │
│   Déjà un wallet ? [Importer]           │
└─────────────────────────────────────────┘
         ↓ (clic Google)
┌─────────────────────────────────────────┐
│        OAuth Google standard            │
│   (popup système, 2 secondes)           │
└─────────────────────────────────────────┘
         ↓ (wallet créé en arrière-plan)
┌─────────────────────────────────────────┐
│           ÉCRAN PRINCIPAL               │
│                                         │
│  Bonjour Jean !                         │
│  Portfolio : 0€                         │
│                                         │
│  ┌─────────────────────────────┐        │
│  │ DeFi5 Index     +12.3% /an │        │
│  │ Top 5 DeFi      À partir   │        │
│  │ protocols        de 10€    │        │
│  │            [Investir]       │        │
│  └─────────────────────────────┘        │
│  ┌─────────────────────────────┐        │
│  │ Blue Chip 10    +8.7% /an  │        │
│  │ Top 10 crypto    À partir  │        │
│  │ par market cap   de 10€    │        │
│  │            [Investir]       │        │
│  └─────────────────────────────┘        │
└─────────────────────────────────────────┘
         ↓ (clic "Investir" sur DeFi5)
┌─────────────────────────────────────────┐
│         ACHETER DeFi5 INDEX             │
│                                         │
│  Montant : [____100____] €              │
│                                         │
│  Vous recevrez : ~0.5 DeFi5            │
│  Frais estimés : ~1.20€                │
│                                         │
│  [Payer par Carte Bleue]                │
│  [Payer avec Apple Pay]                 │
│                                         │
└─────────────────────────────────────────┘
         ↓ (clic CB)
┌─────────────────────────────────────────┐
│  WIDGET ON-RAMP (thirdweb + Transak)     │
│                                         │
│  Carte : **** **** **** ____            │
│  Expiration : __/__ CVV: ___            │
│                                         │
│  Total : 101.20€                        │
│  [Confirmer le paiement]                │
│                                         │
└─────────────────────────────────────────┘
         ↓ (paiement confirmé, 30-60s de traitement)
┌─────────────────────────────────────────┐
│         TRAITEMENT EN COURS             │
│                                         │
│  ⟳ Paiement reçu                       │
│  ⟳ Conversion en cours...              │
│  ○ Achat du Bundle                      │
│                                         │
│  Temps estimé : ~1 minute               │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│           ACHAT CONFIRMÉ !              │
│                                         │
│  Vous détenez maintenant :              │
│  0.5 DeFi5 Index (~98.80€)             │
│                                         │
│  [Voir mon portfolio]                   │
│  [Acheter plus]                         │
└─────────────────────────────────────────┘
```

### 5.2 Utilisateur existant (retour)

```
Ouvrir l'app (auto-login) → Portfolio → Choisir Bundle → CB → Confirmer
```

3 étapes effectives.

### 5.3 Power users (export wallet)

Dans les Settings :

- Exporter la clé privée (protégé par biométrie)
- Connecter un wallet externe (MetaMask, WalletConnect)
- Voir l'adresse du wallet
- Historique des transactions on-chain

### 5.4 Vues globales MVP (scope produit final)

Le MVP mobile doit rester volontairement simple, avec **3 écrans principaux** :

1. **Bundles (Discover)**
  - Liste des bundles disponibles
  - Détail des underlyings (weights/allocations)
  - Prix actuel
  - Courbe de prix (1D / 7D / 1M / 1Y / ALL)
2. **Trade (Acheter / Vendre)**
  - Toggle Buy / Sell
  - Input montant en ETH ou en Bundle Token
  - Quote en temps réel (output estimé + slippage + frais)
  - Exécution en 1 action utilisateur
3. **Portfolio**
  - Positions détenues (quantité, valeur, PnL)
  - Historique des transactions (buy/sell)
  - Accès rapide vers Trade

Pas d'autres tabs MVP: pas de social, pas de watchlist complexe, pas de features annexes.

### 5.6 UX Trade (vue unique, 2 modes)

L'app utilise **une seule vue Trade** pour éviter la complexité UX et code:

- **Mode A: CB -> Bundle**
  - Input en EUR
  - Quote bundle estimé
  - CTA: `Continuer avec carte`
  - Passage au widget on-ramp thirdweb/Transak
- **Mode B: Swap Wallet**
  - Toggle `ETH -> Bundle` ou `Bundle -> ETH`
  - Quote temps réel (`expectedOut`, `minOut`, slippage, price impact)
  - CTA: `Confirmer le swap`

Règles UX obligatoires:

- Mode par défaut: `CB -> Bundle` (funnel principal)
- Même structure visuelle pour les 2 modes: `Input -> Quote -> Confirm`
- États obligatoires: loading, erreur actionable, succès

### 5.7 Spécification UI par écran (contrat d'implémentation)

Chaque écran est défini par ses composants, ses états, et ses critères d'acceptance. Les agents implémentent exactement ce qui est listé.

#### Écran 1 : Bundles (Discover) — Tab principal par défaut

**Composants obligatoires** (ordre d'affichage) :

1. **Header** : logo bundles.fi + avatar user (initiale si pas de photo)
2. **BundleList** : FlatList scrollable
   - Chaque **BundleCard** affiche :
     - Icône bundle (`https://api.bundles.fi/uploads/indexes/1/icons/{address}.png`)
     - Nom + symbole (ex: "DeFi5 Index" / "DFI5")
     - Prix actuel en USD (depuis API serveur bundles `tokens:findOne`)
     - Variation prix sur 24h (% + couleur vert/rouge)
     - Mini sparkline (7 derniers jours, `tokens:getHistory` timeframe=week)
   - Tap sur une card → navigation vers **BundleDetail**
3. **BundleDetail** (écran imbriqué, pas un tab séparé) :
   - Nom, symbole, prix, variation
   - **PriceChart** : Chart.js/Victory, périodes sélectionnables (1D / 7D / 1M / 1Y / ALL)
   - **AssetList** : underlyings avec weight %, adresse token, nom
   - **Stats** : totalSupply, holderCount, swapFee, mintBurnFee
   - **CTA** : `Acheter` (navigue vers Trade avec ce bundle pré-sélectionné)

**États obligatoires** :
- `loading` : skeleton cards pendant le fetch Graph + API
- `empty` : "Aucun bundle disponible" (improbable mais requis)
- `error` : "Impossible de charger les bundles. Réessayer." + bouton retry
- `offline` : "Pas de connexion internet" (détecter via `@react-native-community/netinfo`)

**Données** :
- Source primaire : The Graph (`findIndexes`) + API serveur (`tokens:findOne` pour prix USD)
- Cache : TanStack Query, staleTime 30s

---

#### Écran 2 : Trade — Tab "Trade"

**Mode par défaut** : `CB → Bundle` (Mode A)
**Toggle visible** : switch `Carte bancaire` / `Swap wallet` en haut de l'écran

##### Mode A : CB → Bundle

**Composants** :
1. **BundleSelector** : dropdown ou bottom sheet, bundle pré-sélectionné si vient du Discover
2. **AmountInput** : champ EUR, clavier numérique natif
3. **QuoteDisplay** :
   - Estimation bundles tokens reçus (source primaire: quote fiat thirdweb/Transak, puis estimation route bundle)
   - Frais estimés (on-ramp ~1% + gas ~$0.15)
   - Avertissement KYC si premier achat ("Vérification d'identité requise, ~5 min")
4. **CTA** : `Continuer avec carte` → ouvre widget Transak (thirdweb Payments)
5. **ProgressTracker** (après paiement) : stepper 4 étapes (Paiement → Conversion → Achat → Confirmé)

##### Mode B : Swap Wallet

**Composants** :
1. **DirectionToggle** : `Acheter` (ETH → Bundle) / `Vendre` (Bundle → ETH)
2. **BundleSelector** : idem Mode A
3. **AmountInput** :
   - Acheter : input en bundle tokens → affiche coût ETH (`buyBundle` quote)
   - Vendre : input en bundle tokens → affiche ETH reçu (`sellBundle` quote)
   - Bouton "MAX" pour utiliser tout le solde
4. **QuoteDisplay** :
   - `expectedOut` / `expectedCost` en ETH
   - Slippage (1% par défaut, éditable)
   - Prix unitaire (1 bundle = X ETH)
   - Solde wallet actuel (ETH + bundle token sélectionné)
5. **CTA** : `Confirmer le swap` (disabled si montant = 0, solde insuffisant, ou quote en cours)

**États obligatoires (les 2 modes)** :
- `idle` : formulaire vide, prêt à saisir
- `quoting` : spinner sur le champ output, debounce 500ms après saisie
- `quote_error` : "Impossible d'obtenir un prix. Réessayer." (erreur SDK universal-router)
- `insufficient_balance` : CTA disabled + message "Solde insuffisant" (en rouge sous le champ)
- `confirming` : CTA transformé en spinner, inputs disabled
- `success` : bottom sheet de confirmation avec montants finaux + lien portfolio
- `failed` : message d'erreur actionnable ("Transaction échouée. Réessayer ?")
- `kyc_required` (Mode A uniquement) : interstitiel avant Transak

**Refresh quote** : re-fetch automatique toutes les 15s si l'écran est actif + debounce 500ms sur input change.

---

#### Écran 3 : Portfolio — Tab "Portfolio"

**Composants** (ordre d'affichage) :
1. **PortfolioHeader** :
   - Valeur totale en USD (somme de toutes les positions)
   - Variation globale 24h (% + valeur absolue)
2. **PositionList** : FlatList des bundles détenus
   - Chaque **PositionCard** :
     - Icône + nom + symbole du bundle
     - Quantité détenue (ex: "0.5 DFI5")
     - Valeur en USD
     - PnL (% + valeur, vert/rouge)
   - Tap → navigue vers Trade avec ce bundle pré-sélectionné
3. **WalletInfo** (section repliable "Wallet") :
   - Solde ETH
   - Adresse wallet (tronquée, copie au tap)
4. **EmptyState** (si 0 positions) :
   - "Vous n'avez pas encore de bundles"
   - CTA : `Découvrir les bundles` → navigue vers Discover

**États obligatoires** :
- `loading` : skeleton
- `empty` : EmptyState ci-dessus
- `error` : retry
- `offline` : données cachées + bandeau "Dernière mise à jour il y a X min"

**Données** :
- Positions : The Graph (`findUserData`) + `tokens:findOne` pour prix USD
- Solde ETH : `readContract` (viem) via thirdweb RPC, poll 10s
- Cache : TanStack Query, staleTime 10s, refetchInterval 10s

---

#### Écran 4 : Settings (accessible via icône gear dans le header)

**Composants** :
1. Adresse wallet (tronquée + copie)
2. Exporter la clé privée (protégé par biométrie via `expo-local-authentication`)
3. Déconnexion
4. Version app + liens légaux (Privacy Policy, Terms of Service)

Pas un tab principal. Accessible depuis le header sur n'importe quel écran.

---

#### Règles de formatage UI (obligatoires pour tous les écrans)

| Donnée | Format | Exemple |
| --- | --- | --- |
| Prix USD | `$X,XXX.XX` (2 decimals) | `$1,234.56` |
| Prix EUR (Mode A) | `X XXX,XX €` (format FR) | `1 234,56 €` |
| Variation % | `+X.XX%` / `-X.XX%` + couleur | `+12.34%` (vert) |
| Montant ETH | max 6 decimals significatifs | `0.054321 ETH` |
| Montant bundle | max 4 decimals | `0.5000 DFI5` |
| Adresse wallet | `0xABCD...1234` (4+4 chars) | `0x1a2B...cD3e` |
| Timestamp | relatif si < 24h, date sinon | "il y a 3h" / "15 mars" |

### 5.8 Machine d'états (flows critiques)

Les agents doivent implémenter ces machines d'états. Chaque état a une UI correspondante. Les transitions sont déclenchées par des événements (action user, callback réseau, timer).

#### Auth Flow

```
ANONYMOUS
  → [user tap "Se connecter"] → AUTHENTICATING
    → [OAuth success + wallet created/recovered] → AUTHENTICATED
    → [OAuth error / timeout] → AUTH_FAILED → [retry] → AUTHENTICATING
    → [user cancel] → ANONYMOUS
```

Persistance : état `AUTHENTICATED` persisté via thirdweb SDK (auto-login au redémarrage).

#### Trade Flow — Mode A (CB → Bundle)

```
IDLE
  → [user saisit montant EUR] → QUOTING (debounce 500ms)
    → [quote OK] → QUOTE_READY
    → [quote error] → QUOTE_ERROR → [retry / modify amount] → QUOTING
QUOTE_READY
  → [user tap "Continuer avec carte"] → KYC_CHECK
    → [KYC déjà fait] → PAYMENT_PENDING
    → [KYC requis] → KYC_IN_PROGRESS → [KYC OK] → PAYMENT_PENDING
KYC_IN_PROGRESS
  → [KYC failed / timeout] → KYC_FAILED → [retry] → KYC_IN_PROGRESS
PAYMENT_PENDING (widget Transak ouvert)
  → [paiement confirmé par Transak callback] → FUNDS_PENDING
  → [user annule le widget] → IDLE
  → [paiement échoué] → PAYMENT_FAILED → [retry] → PAYMENT_PENDING
FUNDS_PENDING (polling balance ETH toutes les 5s, timeout 10 min)
  → [ETH reçu dans le wallet] → SWAPPING
  → [timeout 10 min] → FUNDS_TIMEOUT (persister intent, proposer retry au redémarrage)
SWAPPING (tx envoyée)
  → [receipt.status === success] → SUCCESS
  → [receipt.status === reverted] → SWAP_FAILED → [retry avec re-quote] → QUOTING
  → [tx timeout / RPC error] → SWAP_FAILED
SUCCESS
  → [user tap "Voir portfolio"] → navigation Portfolio
```

**Persistance critique** : à l'entrée de `PAYMENT_PENDING`, persister dans AsyncStorage :
```typescript
type PurchaseIntent = {
  id: string;                    // UUID unique (anti-double-buy)
  bundleAddress: Address;
  desiredBundleAmount: string;   // stringified bigint
  expectedEthCost: string;
  status: "payment_pending" | "funds_pending" | "swapping";
  createdAt: number;
};
```
Au redémarrage de l'app, si un intent est trouvé avec status != terminé → reprendre le flow.

#### Trade Flow — Mode B (Swap Wallet)

```
IDLE
  → [user saisit montant bundle] → QUOTING (debounce 500ms)
    → [quote OK] → QUOTE_READY
    → [quote error] → QUOTE_ERROR
QUOTE_READY
  → [user tap "Confirmer le swap"] → APPROVING (sell uniquement)
    → [approve success] → SWAPPING
    → [approve revert] → APPROVE_FAILED
  → [user tap "Confirmer le swap" pour buy] → SWAPPING
SWAPPING
  → [receipt.status === success] → SUCCESS
  → [receipt.status === reverted] → SWAP_FAILED
SUCCESS
  → [auto-invalidate queries portfolio + bundle detail]
```

### 5.9 Direction UI mobile (inspirée du desktop bundles.fi)

Les captures desktop et le repo **`bundles-frontend`** définissent la source de vérité: Outfit + Azeret Mono (Google Fonts), fond `gray-100`, boutons primaires **gris** (`btn-primary` = gray-700), états succès **emerald/green**, or (`gold-*`) pour accents chart/brand.  
Objectif mobile: **mêmes tokens** que `lib/ui-tokens.ts` + `tailwind.config.js` (synchronisés avec le web).

#### 5.9.1 Éléments branding à conserver (bundles-frontend → mobile)

- **Typo**: Outfit (corps ~300), Azeret Mono pour chiffres / mono.
- **Palette** (alignée desktop):
  - Fond principal `gray-100` / loader `#f4f4f8`
  - Cartes blanches (`#FFFFFF`)
  - Texte `gray-700` / titres forts `#151516`
  - Texte secondaire `gray-500`
  - **CTA primaire** = `gray-700` (pas vert — le vert MVP était une approximation)
  - Positif / PnL: emerald-600 / green-600 ; négatif: red/rose
  - Accent brand: échelle `gold-*` (optionnel)
- **Style global**:
  - Minimal, financier, peu d'effets visuels
  - Coins arrondis modérés (8-12px)
  - Bordures `gray-300`
  - Hiérarchie typo sobre (pas de titres surdimensionnés)
- **Composants identitaires**:
  - Bundle icon + nom + ticker partout
  - Pastilles d'underlyings compactes
  - Boutons pleins, lisibles, un CTA principal par écran

#### 5.9.2 Mapping des écrans desktop vers mobile

| Desktop actuel | Mobile cible | Décision |
| --- | --- | --- |
| Table Explore (name/ticker, assets, price, 1d, MC, View) | Liste de cards scrollables | Garder toutes les infos core, compacter en 2 lignes + ligne métriques |
| Screen détail bundle (underlyings + chart) | Détail bundle intégré à Discover | Garder chart + underlyings + CTA vers Trade |
| Zone settings bundle + form buy/sell (même page) | Trade séparé en vue unique 2 modes | Simplifier: pas de surcharge info pendant l'action trading |

#### 5.9.3 Ce qu'on garde absolument (core info)

- **Dans Discover list**:
  - Nom + ticker
  - Underlyings (icônes compactes, max 5 visibles + "+N")
  - Prix actuel
  - Variation 24h
  - Market cap
  - CTA secondaire `Voir`
- **Dans Bundle detail**:
  - Underlyings avec weight %
  - Graph de prix (1D/7D/1M/1Y/ALL)
  - Métriques bundle: market cap, mint/burn fee, rebalancing threshold, distributed fees
  - CTA principal `Acheter / Vendre`
- **Dans Trade**:
  - Form Buy/Sell clair
  - Quote instantanée
  - Solde utilisateur
  - Slippage visible

#### 5.9.4 Ce qu'on simplifie pour mobile (lisibilité + maintenabilité)

- Éviter les tables multi-colonnes desktop -> utiliser cards verticales.
- Limiter les infos simultanées à 5-7 points par viewport.
- Déplacer les infos avancées (curator address, eq. price delta détaillé) dans une section "Détails avancés" repliable.
- Retirer les modes "Auto/Manual" complexes du MVP si non indispensables au succès trade.
- Un seul CTA primaire par écran (ex: `Continuer avec carte`, `Confirmer le swap`).

#### 5.9.5 Règles UI spécifiques aux captures fournies

- **Explore list (capture 1)**:
  - Conserver la sensation "market board" mais en cards:
    - Ligne 1: icon + nom + ticker
    - Ligne 2: underlyings (pastilles) + price
    - Ligne 3: 24h variation + market cap + bouton `Voir`
- **Bundle detail (capture 2)**:
  - Sur mobile, organiser en blocs:
    1. Header bundle (icon, nom, ticker)
    2. Price + variation
    3. Chart
    4. Underlyings list
    5. CTA `Trade`
- **Bundle settings + trade form (capture 3)**:
  - Split en 2 sections empilées:
    1. "Bundle Metrics" (rebalancing threshold, mint/burn fee, market cap, distributed fees)
    2. "Trade Form" (Buy/Sell tabs + amount + quote + balance + CTA)
  - Sur petits écrans: afficher `Bundle Metrics` en accordéon fermé par défaut.

#### 5.9.6 Design tokens (source = `bundles-frontend` + `lib/ui-tokens.ts`)

Ne pas dupliquer ici la liste exhaustive: **voir `lib/ui-tokens.ts`** (couleurs, `fontFamily`, rayons).  
Règle: ne pas multiplier les variantes visuelles — NativeWind + un seul set de tokens, synchronisé avec le repo web lors des changements branding.

### 5.5 Process fonctionnel Buy/Sell (MVP)

#### Achat (ETH -> Bundle)

1. User choisit un bundle + montant ETH
2. L'app demande une quote au moteur `universal-router`
3. Le routeur calcule le ratio d'underlyings optimal
4. Exécution on-chain: achat des underlyings + mint Bundle Token
5. L'utilisateur reçoit ses Bundle Tokens dans son wallet embedded

#### Vente (Bundle -> ETH)

1. User choisit un bundle + montant Bundle Token
2. L'app demande une quote au moteur `universal-router`
3. Le routeur calcule le désassemblage optimal
4. Exécution on-chain: burn Bundle Token + vente des underlyings
5. L'utilisateur reçoit de l'ETH dans son wallet

Le mobile ne doit pas réimplémenter la logique de routing: il consomme la même logique que le front web.

---

## 6. Architecture Technique Détaillée

### 6.1 Architecture globale

```
┌──────────────────────────────────────────────────────────┐
│                   APPLICATION MOBILE                      │
│                 (React Native + Expo)                     │
│                                                          │
│  ┌────────────┐  ┌────────────┐  ┌───────────────────┐  │
│  │ UI Layer   │  │ thirdweb   │  │ State             │  │
│  │ (NativeWind)│ │ SDK v5     │  │ (Zustand +        │  │
│  │            │  │            │  │  TanStack Query)  │  │
│  └─────┬──────┘  └─────┬──────┘  └────────┬──────────┘  │
│        │               │                  │             │
│  ┌─────┴───────────────┴──────────────────┴──────────┐  │
│  │            thirdweb React Native SDK               │  │
│  │  ┌─────────────┐  ┌────────────────────────────┐  │  │
│  │  │ In-App      │  │ On-ramp                    │  │  │
│  │  │ Wallet EOA  │  │ (Transak ETH — MVP)        │  │  │
│  │  │ (Social     │  │                            │  │  │
│  │  │  Login)     │  │                            │  │  │
│  │  └──────┬──────┘  └─────────────┬──────────────┘  │  │
│  └─────────┼───────────────────────┼─────────────────┘  │
└────────────┼───────────────────────┼────────────────────┘
             │                       │
             ▼                       ▼
┌────────────────┐  ┌─────────────────────────────────────┐
│   thirdweb     │  │   Ethereum L1                       │
│   Auth +       │  │                                     │
│   Key Mgmt     │  │   UniversalRouter (0x1751F0...7c00) │
│   (TEE/Shards) │  │   ├── swapETHForExactTokens → buy   │
│   RPC inclus   │  │   └── swapExactTokensForETH → sell  │
└────────────────┘  └─────────────────────────────────────┘
```

Pas de backend, pas de bundler, pas de paymaster, pas d'EntryPoint.
L'app parle directement à Ethereum via le RPC thirdweb + le wallet embedded.
En production, le réseau cible est Ethereum mainnet (`chainId: 1`). En test/preprod, Avalanche Fuji (`chainId: 43113`) est autorisé pour validation.

### 6.3 Smart Contracts — Architecture réelle (Ethereum mainnet)

Les contrats existent déjà et sont déployés. L'app mobile ne déploie rien, elle interagit avec eux.

#### Contrats principaux

| Contrat | Adresse | Rôle |
| --- | --- | --- |
| **UniversalRouter** | `0x1751F0eADFeB3d618B9e4176edDC9E7D24657c00` | Point d'entrée unique pour buy/sell. Exécute les routes multi-DEX |
| **Factory** | `0x209bE93480e23CA0876d5f9D6fbBD61490173f04` | Création de nouveaux index/bundles |
| **Router (Bundles Swap)** | `0x6b8Cd00Eeff2e8D9f563869B068D9C64EF1Dd791` | Router d'échange interne Bundles |
| **Protocol Token** | `0x695f775551fb0D28b64101c9507c06F334b4bA86` | Token natif du protocole |
| **ExchangePosition** | `0xC2b84f1F3B0b56c26A15C84aE3191cf487a28a8c` | NFT des positions LP |
| **ExchangeFactory** | `0xAcff9eee0a5522000E7141b77107359A6462E8d2` | Factory des paires d'échange |
| **Staking** | `0x03ae8f37d0Fbe54EcEcD59382cd7991f42FceBd0` | Staking des positions LP |
| **WETH** | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | Wrapped ETH (token intermédiaire standard) |

#### Fonctions du UniversalRouter utilisées par l'app

```
swapETHForExactTokens(_tokenOut, _amountOut, _data, _deadline) → payable
  - Buy: envoyer ETH, recevoir des Bundle Tokens
  - _data = calldata interne calculé par le SDK universal-router
  - msg.value = ethCost + slippage buffer (excédent remboursé)

swapExactTokensForETH(_tokenIn, _amountIn, _minEthOut, _data, _deadline)
  - Sell: envoyer des Bundle Tokens, recevoir de l'ETH
  - Nécessite un approve ERC20 préalable sur le UniversalRouter
  - _minEthOut = protection slippage
```

#### ABIs

Les ABIs sont disponibles dans :
- `../bundles-frontend/src/onchain/artifacts/1.0/external/UniversalRouterContract.json`
- `../bundles-frontend/src/onchain/artifacts/1.0/IndexContract.json` (bundle token ERC20)
- `../bundles-frontend/src/onchain/artifacts/1.0/interfaces/IERC20.json`

Le SDK `@bundlesfi/universal-router` exporte aussi les ABIs nécessaires (`universalRouterAbi`).

#### DEX utilisés par le routing (transparents pour l'app)

Le SDK `universal-router` agrège automatiquement les quotes de :
- Uniswap V2, V3, V4
- Bundles Swap (DEX interne)
- Antfarm V1
- Aave V3 (flash routes)

L'app mobile n'a pas besoin de connaître ces détails : elle appelle `buyBundle` / `sellBundle` et le SDK choisit la meilleure route.

### 6.4 Coûts gas réels sur Ethereum L1 (2026)

Depuis le Dencun upgrade (mars 2024) et l'adoption massive des L2, le gas L1 est très bas :


| Métrique                   | Valeur      |
| -------------------------- | ----------- |
| Gas moyen                  | ~0.037 Gwei |
| Transfert simple (21K gas) | ~$0.002     |
| Swap DEX (150K gas)        | ~$0.02-0.39 |
| Approve ERC-20 (46K gas)   | ~$0.01-0.20 |


**Coût réel par achat de Bundle :**

- Via ETH (1 tx) : **~$0.02-0.39**

Ces coûts sont à la charge de l'utilisateur, déduits automatiquement de l'ETH reçu.
Représente ~0.03-0.6% d'un achat de 100€. Négligeable.

### 6.5 Réutilisation des repos existants (obligatoire)

Pour accélérer le delivery et garantir la cohérence produit, l'app mobile doit réutiliser les assets et patterns déjà validés.

#### 6.5.1 `../bundles-frontend` — Source UI + data patterns

**Stack web** : Vue 3 + Vite + Pinia + TanStack Vue Query + viem/wagmi + graphql-request

L'app mobile adapte les patterns suivants (pas de copie directe Vue → React, mais même logique) :

| Pattern web (Vue) | Adaptation mobile (React Native) | Fichier source de référence |
| --- | --- | --- |
| Pinia stores | Zustand stores | `src/stores/protocol.store.ts` |
| TanStack Vue Query | TanStack React Query | `src/composables/` |
| graphql-request | graphql-request (même lib) | `src/libraries/graph/` |
| viem `writeContract` | thirdweb `sendTransaction` | `src/libraries/Transactions.ts` |
| wagmi connectors | thirdweb In-App Wallet | `src/config/wagmi.ts` |
| Chart.js | Victory Native + react-native-svg | `src/components/TokenHistoryChart.vue` |

**Vues à adapter** :

| Vue web | Écran mobile | Fichier source |
| --- | --- | --- |
| `IndexListView` | Bundles (Discover) | `src/views/IndexListView.vue` |
| `IndexView` (détail + BuySellForm) | Détail Bundle + Trade | `src/views/IndexView.vue` |
| `PortfolioView` | Portfolio | `src/views/PortfolioView.vue` |

**Modèles de données à reprendre** (adapter en TS pur, pas de classes) :

```typescript
// Depuis src/models/ de bundles-frontend — à convertir en types/interfaces TS purs

type BundleToken = {
  chainId: number;
  address: `0x${string}`;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  assets: BundleAsset[];
  swapFee?: number;
  mintBurnFee?: number;
  priceUSD?: number;
  priceVariations?: { lastHour?: number; lastDay?: number; lastWeek?: number; lastMonth?: number };
};

type BundleAsset = {
  tokenAddress: `0x${string}`;
  startWeight: number;
  endWeight: number;
  balance: bigint;
};

type UserPosition = {
  bundleAddress: `0x${string}`;
  balance: bigint;
  valueUSD?: number;
  pnl?: number;
};

type PriceHistory = {
  tokenAddress: `0x${string}`;
  timeframe: "day" | "week" | "month" | "year";
  history: { priceUSD: number; createdAt: number }[];
};
```

**Pattern de fetch prix** (chaîne de fallback, depuis `Token.fetchPriceUsd()`) :

1. API serveur bundles (`tokens:findOne` → `statistics.priceUSD`)
2. Fallback Alchemy (`api.g.alchemy.com/prices/v1/.../tokens/by-address`)
3. Fallback Moralis (`deep-index.moralis.io/api/v2.2/erc20/.../price`)

**Historique prix** : API serveur bundles (`tokens:getHistory` → timeframe day/week/month/year)

#### 6.5.2 `../universal-router` — Moteur de pricing/routing

**Type** : SDK TypeScript (lib, pas de smart contracts)
**Dépendance unique** : `viem` (pas d'ethers)
**Package** : `@bundlesfi/universal-router` (installé depuis un `.tgz` local dans bundles-frontend)

**API de production utilisée par l'app mobile** :

```typescript
import { buyBundle, sellBundle, quoteBundles } from "@bundlesfi/universal-router";

// ---- BUY (ETH → Bundle) ----
const buyResult = await buyBundle(publicClient, bundleAddress, amountOut, {
  deadline: 300,         // secondes
  routeHints,            // Map<Address, Address[]> — routes intermédiaires optionnelles
  printLogs: false,
});
// buyResult.calldata  → hex string, inner routing data pour swapETHForExactTokens
// buyResult.ethCost   → bigint, coût exact en wei

// ---- SELL (Bundle → ETH) ----
const sellResult = await sellBundle(publicClient, bundleAddress, amountIn, {
  deadline: 300,
});
// sellResult.calldata    → hex string, inner routing data pour swapExactTokensForETH
// sellResult.ethProceeds → bigint, ETH reçu en wei

// ---- QUOTE VALUATION (valeur ETH d'un bundle) ----
const quotes = await quoteBundles(publicClient, [bundleAddress1, bundleAddress2]);
// quotes[i].ethValue → valeur en ETH du bundle
```

**RouteHints** (optionnel, améliore certaines routes) :

```typescript
// Map<tokenAddress, intermediateTokens[]>
// Ex: pour EURC, passer par USDT comme intermédiaire
const routeHints: RouteHints = new Map([
  ["0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c", ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"]]
]);
```

**Intégration dans le projet mobile** :

```bash
# Copier le tgz depuis bundles-frontend ou builder depuis ../universal-router
npm install ../universal-router
# ou
npm install ./bundlesfi-universal-router-0.0.12.tgz
```

**Ce que le SDK fait en interne** (transparent pour l'app) :

1. Multicall les quoters de chaque DEX (Uniswap V2/V3/V4, Bundles Swap, Antfarm, Aave V3)
2. Pour les bundles : décompose en underlyings, compare route directe vs mint/burn
3. Choisit la meilleure route
4. Construit le calldata encodé pour le UniversalRouter
5. Retourne `{ calldata, ethCost | ethProceeds }`

**Ce que l'app mobile fait** :

1. Appelle `buyBundle` / `sellBundle` avec un `publicClient` viem
2. Récupère le calldata + montant
3. Applique le slippage
4. Envoie la transaction au UniversalRouter via thirdweb wallet
5. Attend le receipt et vérifie `receipt.status === "success"`

### 6.6 Architecture data mobile (alignée frontend web)

#### Sources de données

| Source | Données | Lib/Protocol | Fréquence |
| --- | --- | --- | --- |
| **The Graph** | Bundles list, underlyings, weights, pools, positions, events | `graphql-request` | Cache TanStack Query (stale: 30s) |
| **Smart contracts** (viem `readContract`) | Balances ERC20 user, totalSupply, allowance | `viem` + thirdweb RPC | Poll 10s sur écran actif |
| **Universal Router SDK** | Quotes buy/sell (ethCost, ethProceeds, calldata) | `@bundlesfi/universal-router` | À chaque changement de montant (debounce 500ms) |
| **API serveur bundles** | Prix USD tokens, historique prix (chart) | WebSocket / HTTP | Cache TanStack Query (stale: 60s) |
| **Alchemy / Moralis** (fallback) | Prix USD tokens | HTTP REST | Fallback si API serveur indisponible |

#### The Graph — Subgraph bundles.fi

**URLs par réseau** :
- Ethereum mainnet (`chainId: 1`) : `https://gateway.thegraph.com/api/{API_KEY}/subgraphs/id/9XrX1raUFtuEksCevfvYhNUpiyiKEuqxQXcbBzFfnVkY`
- Avalanche Fuji (`chainId: 43113`) : `https://gateway.thegraph.com/api/{API_KEY}/subgraphs/id/EhCcsqpEyd4pbuoQtVNwFL5vU2aGCzrYakEYxwYjZqBj`

**Queries à implémenter côté mobile** (adaptées de `../bundles-frontend/src/libraries/graph/`) :

```graphql
# 1. Liste des bundles (écran Bundles)
query findIndexes($first: Int, $skip: Int, $orderBy: String, $orderDirection: String) {
  indexes(first: $first, skip: $skip, orderBy: $orderBy, orderDirection: $orderDirection) {
    id
    address
    name
    symbol
    decimals
    totalSupply
    swapFee
    mintBurnFee
    holderCount
    assets {
      token { id address name symbol decimals }
      startWeight
      endWeight
      balance
    }
    liquidityPool {
      address
      reserve0
      reserve1
      fee
    }
  }
}

# 2. Détail d'un bundle (écran détail)
query getIndex($indexAddress: ID!) {
  index(id: $indexAddress) {
    id address name symbol decimals totalSupply
    swapFee mintBurnFee holderCount
    assets {
      token { id address name symbol decimals }
      startWeight endWeight balance
    }
    liquidityPool { address reserve0 reserve1 fee }
  }
}

# 3. Positions utilisateur (écran Portfolio)
query findUserData($user: String!, $first: Int, $skip: Int) {
  userIndexBalances(
    where: { user: $user }
    first: $first
    skip: $skip
    orderBy: "balance"
    orderDirection: "desc"
  ) {
    index { id address name symbol decimals totalSupply }
    balance
  }
}

# 4. Pool du protocol token (pour prix de ref)
query getProtocolTokenPool($protocolToken: String!, $weth: String!) {
  pools(where: { or: [
    { token0: $protocolToken, token1: $weth },
    { token0: $weth, token1: $protocolToken }
  ]}) {
    address reserve0 reserve1 fee
    token0 { address symbol decimals }
    token1 { address symbol decimals }
  }
}
```

#### Stratégie de synchronisation (TanStack React Query)

```typescript
// Exemples de query keys et staleTime
const queryConfig = {
  bundles: {
    queryKey: ["bundles", "list"],
    staleTime: 30_000,       // 30s — liste relativement stable
    refetchOnWindowFocus: true,
  },
  bundleDetail: (address: string) => ({
    queryKey: ["bundles", "detail", address],
    staleTime: 15_000,       // 15s — sur l'écran de trade, besoin de fraîcheur
  }),
  userPositions: (userAddress: string) => ({
    queryKey: ["portfolio", userAddress],
    staleTime: 10_000,       // 10s — refresh fréquent
    refetchInterval: 10_000, // auto-poll quand l'écran est actif
  }),
  quote: (bundleAddress: string, amount: string, side: "buy" | "sell") => ({
    queryKey: ["quote", bundleAddress, amount, side],
    staleTime: 5_000,        // 5s — quote fraîche obligatoire
    gcTime: 10_000,          // garbage collect vite (quotes obsolètes)
  }),
};
```

**Invalidation post-transaction** : après un buy/sell réussi, invalider `["portfolio", userAddress]` et `["bundles", "detail", bundleAddress]`.

#### Contrat d'interface mobile ↔ universal-router

```typescript
// Input (ce que l'app envoie au SDK)
type QuoteRequest = {
  bundleAddress: `0x${string}`;
  side: "buy" | "sell";
  amount: bigint;            // amountOut (buy) ou amountIn (sell)
  deadline?: number;         // secondes, default 300
  routeHints?: Map<`0x${string}`, `0x${string}`[]>;
};

// Output (ce que le SDK retourne)
type BuyQuoteResult = {
  calldata: `0x${string}`;   // inner routing data
  ethCost: bigint;            // coût en wei
};

type SellQuoteResult = {
  calldata: `0x${string}`;   // inner routing data
  ethProceeds: bigint;        // ETH reçu en wei
};
```

L'objectif est une couche mobile thin-client : UI + orchestration + signature, sans logique de market routing dupliquée.

### 6.7 API Contracts — Endpoints, formats, auth, fallbacks

L'app mobile ne crée pas de **nouveau backend applicatif**. Elle se connecte à l'**API serveur bundles existante** (même serveur que le frontend web) + The Graph + RPC.

#### 6.7.1 API Serveur Bundles (WebSocket)

**URL production** : `wss://api.bundles.fi/ws/`
**URL dev** : `ws://localhost:3000/ws/`
**Env var** : `EXPO_PUBLIC_API_WS_ENDPOINT`
**Auth** : aucune pour les lectures. Pas de header, pas de token. Connexion WebSocket plain.
**Reconnexion** : auto-reconnect après 3s si la connexion se ferme (sauf code 1000 = fermeture normale).

**Format de requête** :

```typescript
type WsRequest = {
  id: number;       // auto-incrémenté côté client
  route: string;    // ex: "tokens:findOne"
  data: unknown;    // payload de la requête
};
```

**Format de réponse** :

```typescript
type WsResponse = {
  id: number;       // même id que la requête
  data: unknown;    // payload de la réponse
  error?: boolean;  // true si erreur côté serveur
};
```

**Routes utilisées par l'app mobile** :

| Route | Request payload | Response payload | Usage mobile |
| --- | --- | --- | --- |
| `tokens:findOne` | `{ tokenAddress: Address, chainId: ActiveChainId }` | `{ code: 1, data: { address, symbol, name, decimals, statistics: { priceUSD, priceVariations: { lastHour, lastDay, lastWeek, lastMonth } } } }` | Prix USD + variation pour chaque bundle |
| `tokens:getHistory` | `{ chainId: ActiveChainId, tokenAddress: Address, timeframe: "day"\|"week"\|"month"\|"year"\|"all" }` | `{ code: 1, data: Array<{ priceUSD: number, createdAt: string }> }` | Courbe de prix (PriceChart) |
| `indexes:find` | `{ chainId: ActiveChainId }` | `{ code: 1, data: Array<IndexData> }` | Liste bundles (complément au Graph) |
| `indexes:findOne` | `{ indexAddress: Address, chainId: ActiveChainId }` | `{ code: 1, data: IndexData }` | Détail bundle |

**Stratégie de fallback si WebSocket indisponible** :

1. Tentative de reconnexion (3 retries, backoff 3s/6s/12s)
2. Mode A (EUR UI estimate): source primaire = quote fiat thirdweb/Transak (si disponible via SDK). Fallback = taux `ETH/EUR` via CoinGecko (`simple/price`) pour estimation indicative uniquement (jamais utilisé pour exécution on-chain).
3. Fallback prix USD token → Alchemy Token Prices API (`GET https://api.g.alchemy.com/prices/v1/{apiKey}/tokens/by-address?address={addr}&network=eth-mainnet`)
4. Fallback prix USD token → Moralis (`GET https://deep-index.moralis.io/api/v2.2/erc20/{addr}/price?chain=eth`)
5. Si tous les fallbacks échouent → afficher le dernier prix en cache + bandeau "Prix potentiellement obsolète"

#### 6.7.2 The Graph (GraphQL)

**URLs par réseau** :
- Ethereum mainnet (`chainId: 1`) : `https://gateway.thegraph.com/api/{API_KEY}/subgraphs/id/9XrX1raUFtuEksCevfvYhNUpiyiKEuqxQXcbBzFfnVkY`
- Avalanche Fuji (`chainId: 43113`) : `https://gateway.thegraph.com/api/{API_KEY}/subgraphs/id/EhCcsqpEyd4pbuoQtVNwFL5vU2aGCzrYakEYxwYjZqBj`
**Env var** : `EXPO_PUBLIC_GRAPH_API_KEY`
**Auth** : API key dans l'URL (fourni par The Graph)
**Lib** : `graphql-request` (même que le frontend web)
**Timeout** : 10s, retry 1 fois

Queries détaillées en section 6.6.

**Stratégie d'erreur** :

- Rate limit (429) → backoff exponentiel (2s, 4s, 8s)
- Timeout / 5xx → retry 1 fois, puis afficher cache + message
- Subgraph en retard (block indexé < block actuel) → données OK mais potentiellement 1-2 blocs de retard (acceptable)

#### 6.7.3 RPC EVM (chain-aware)

**Provider principal** : thirdweb RPC (inclus dans le SDK, pas de config supplémentaire, chaîne active)
**Fallback** : `https://0xrpc.io/eth` (gratuit, public)
**Env var pour fallback** : `EXPO_PUBLIC_RPC_FALLBACK_URL`
**Usage** : `readContract` (balances, allowances), `sendTransaction` (buy/sell), `waitForReceipt`
**Timeout** : 15s par appel, retry 2 fois avec rotation fallback

```typescript
// Config viem publicClient avec fallback
import { createPublicClient, http, fallback } from "viem";
import { mainnet } from "viem/chains";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: fallback([
    http(), // thirdweb RPC (configuré par défaut via le SDK)
    http(process.env.EXPO_PUBLIC_RPC_FALLBACK_URL ?? "https://0xrpc.io/eth"),
  ], { rank: false, retryCount: 2 }),
});
```

#### 6.7.4 Assets statiques (icônes bundles)

**Base URL** : `https://api.bundles.fi/uploads`
**Pattern** :
- Icône : `{base}/indexes/{chainId}/icons/{address}.png`
- Logo : `{base}/indexes/{chainId}/logos/{address}.avif`
- Bannière : `{base}/indexes/{chainId}/banners/{address}.avif`

Cache images via `expo-image` (cache disk natif).

#### 6.7.5 Variables d'environnement complètes

```bash
# .env (Expo)
EXPO_PUBLIC_THIRDWEB_CLIENT_ID=xxx          # thirdweb dashboard
EXPO_PUBLIC_API_WS_ENDPOINT=wss://api.bundles.fi/ws/
EXPO_PUBLIC_GRAPH_API_KEY=xxx               # The Graph Studio
EXPO_PUBLIC_RPC_FALLBACK_URL=https://0xrpc.io/eth
EXPO_PUBLIC_SENTRY_DSN=xxx                  # Sentry projet mobile
EXPO_PUBLIC_TRANSAK_API_KEY=xxx             # Transak dashboard
```

Jamais de secret privé dans les env vars Expo (elles sont embarquées dans le bundle JS).

---

## 7. App Store — Conformité Réglementaire

### Points critiques

#### Google Play (Policy effective 28 Jan 2026)

- **Bonne nouvelle** : Les wallets non-custodial sont **exemptés** de la policy "Cryptocurrency Exchanges and Software Wallets"
- bundles.fi n'est PAS un exchange → pas de licence MSB/FINTRAC nécessaire pour l'app
- Le on-ramp est géré par les providers (Transak, Coinbase) qui ont leurs propres licences
- **Attention** : Ne pas promouvoir de "gains" ou "rendements garantis" dans la description de l'app

#### Apple App Store

- Guideline 3.1.5(iii) : Les services d'exchange crypto doivent être limités aux pays où l'app a les licences appropriées
- **Important** : Comme c'est le provider on-ramp (pas toi) qui fait l'exchange fiat→crypto, le risque est réduit
- Prévoir documentation des partenariats avec les providers pour le review process

#### EU / MiCA (deadline Juin 2026)

- MiCA impose des obligations aux "Crypto-Asset Service Providers" (CASP)
- Si bundles.fi fait uniquement du **non-custodial** + **on-ramp via tiers**, la classification CASP est probablement évitable
- À valider avec un avocat spécialisé crypto/fintech

### Recommandations pour le review

1. **Description App Store** : "Investissement dans des indices on-chain" plutôt que "trading crypto"
2. **Disclaimer visible** : "Les performances passées ne garantissent pas les résultats futurs"
3. **Pas de promesse de rendement** dans les screenshots/description
4. **Privacy Policy** et **Terms of Service** solides
5. **KYC délégué** aux providers on-ramp (documentation prête pour Apple/Google)

---

## 8. Audit Externe — Challenges & Risques

### Scope verrouillé : on-ramp ETH uniquement (mainnet prod)

Le MVP est volontairement verrouillé sur un seul flow principal : **CB -> ETH -> UniversalRouter.swapETHForExactTokens -> Bundle Token** (on-ramp sur mainnet) + mode swap wallet direct (mainnet et Fuji test env).

Raison: simplicité produit, coûts maîtrisés, moins de surface d'erreur, et exécution en une seule transaction on-chain.

---

### Sécurité : Analyse des risques

#### 1. Dépendance thirdweb (vendor lock-in) — RISQUE MOYEN

thirdweb contrôle le wallet de chaque utilisateur (même en enclave, c'est leur infrastructure).


| Risque                                    | Impact                                                                       | Probabilité | Mitigation                                                                                                                    |
| ----------------------------------------- | ---------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| thirdweb augmente ses prix après la promo | Coûts imprévus (après 12 mois : 10K MAU = $135/mois, 100K MAU = $1,500/mois) | Moyenne     | Prévoir le budget, ou migrer vers Web3Auth (MetaMask-backed) / Privy                                                          |
| thirdweb tombe en panne                   | Les utilisateurs ne peuvent plus signer de transactions                      | Faible      | Export de clé privée toujours possible. Les fonds restent on-chain, accessibles via n'importe quel wallet                     |
| thirdweb est compromis (hack enclave)     | Accès potentiel aux clés privées des utilisateurs                            | Très faible | Modèle enclave (depuis nov. 2024) : clés jamais en clair hors enclave, même les opérateurs serveur n'y ont pas accès. Audité. |
| thirdweb ferme / pivote                   | Perte d'accès au service wallet                                              | Faible      | Tous les utilisateurs peuvent exporter leur clé privée à tout moment. Migration vers un autre provider possible               |


**Alternatives à thirdweb évaluées :**


| Provider     | Sécurité             | Lock-in            | Prix                           | Self-host      | Verdict                                           |
| ------------ | -------------------- | ------------------ | ------------------------------ | -------------- | ------------------------------------------------- |
| **thirdweb** | Enclave (bon)        | Élevé (all-in-one) | Free 12 mois → $0.01-0.015/MAU | Non            | **Retenu** (simplicité, SDK RN mature)            |
| **Privy**    | TEE + sharding (bon) | Moyen              | Free <500 MAU → $299/mois Core | Non            | Trop cher pour le démarrage                       |
| **Web3Auth** | MPC-TSS (bon)        | Faible (modulaire) | Free <1000 MAU → $0.02/MAU     | Oui (Sapphire) | **Alternative sérieuse** si besoin d'indépendance |
| **Openfort** | Open-source          | Très faible        | Usage-based                    | Oui            | Moins mature, SDK RN limité                       |


thirdweb reste le meilleur choix pour le MVP (SDK React Native le plus abouti, intégration on-ramp native, documentation abondante). Mais planifier une migration vers Web3Auth si les coûts thirdweb deviennent prohibitifs — Web3Auth est self-hostable et adossé à MetaMask.

#### 2. Auto-signature des transactions — RISQUE ÉLEVÉ à adresser

Le wallet embedded signe les transactions **sans confirmation utilisateur**. C'est ce qui rend l'UX fluide, mais c'est aussi le plus gros vecteur d'attaque.


| Menace                              | Scénario                                                                                                                         | Impact                                          | Mitigation                                                                                                                            |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Code malveillant poussé via OTA** | Un attaquant compromet le compte Expo/EAS et push une mise à jour qui signe des transactions vidant les wallets                  | Catastrophique — tous les utilisateurs affectés | Désactiver les OTA updates pour les builds de production. Passer uniquement par l'App Store/Play Store (review obligatoire)           |
| **Supply chain attack npm**         | Un package npm compromis (ex: attaque GlueStack juin 2025, Nx 2025) injecte du code qui signe des transactions à l'insu de l'app | Catastrophique                                  | `npm audit` systématique, lockfile strict, dépendances minimales, review des updates de packages critiques                            |
| **Bug dans le UniversalRouter**        | Le contrat a un bug qui permet de drainer les fonds envoyés                                                                      | Élevé                                           | Audit du contrat par un cabinet spécialisé (Trail of Bits, OpenZeppelin). Utiliser des patterns éprouvés (SafeERC20, ReentrancyGuard) |
| **Slippage/sandwich attack**        | Un attaquant sandwich la transaction de swap, l'utilisateur reçoit beaucoup moins de Bundle Tokens                               | Moyen                                           | `minAmountOut` calculé côté app avec slippage max de 1-2%. Le UniversalRouter doit revert si le slippage est dépassé                     |


**Recommandations sécurité obligatoires :**

1. **Désactiver les OTA updates Expo** en production — toute mise à jour passe par le store (Apple/Google review)
2. **Audit du UniversalRouter** avant déploiement — c'est le contrat par lequel passe 100% des fonds
3. **Whitelist des contrats** : l'app ne doit pouvoir interagir qu'avec le UniversalRouter et les tokens connus. Pas de transaction arbitraire
4. **Montant maximum par tx** : limiter les montants par transaction côté app comme garde-fou
5. **Lockfile + npm audit** : vérifier les dépendances à chaque build
6. **Monitoring on-chain** : alerter si des transactions anormales sont détectées sur le UniversalRouter

#### 3. Polling et résilience — RISQUE MOYEN

Le flow repose sur un polling côté app pour détecter l'arrivée des fonds. Cas problématiques :


| Problème                                                      | Impact                                                                                                      | Solution                                                                                                                                        |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| L'utilisateur ferme l'app entre le paiement CB et le swap     | ETH arrive mais le swap ne s'exécute pas. L'utilisateur voit du "ETH brut" dans son wallet, ne comprend pas | Au redémarrage de l'app, détecter les fonds non-swappés et proposer de compléter l'achat. Stocker l'intention d'achat en AsyncStorage local     |
| Le on-ramp prend 10+ minutes                                  | L'utilisateur est bloqué sur un écran "en cours"                                                            | Afficher un message "Votre achat est en cours de traitement, vous pouvez fermer l'app. Vous recevrez une notification." Traiter en arrière-plan |
| Quelqu'un envoie de l'ETH au wallet indépendamment du on-ramp | L'app pourrait essayer de swapper un montant inattendu                                                      | Tracker le montant attendu (via l'event on-ramp) et ne swapper que ce montant, pas le balance total                                             |
| Double on-ramp avant que le premier swap ne soit terminé      | Race condition — 2 swaps concurrents                                                                        | Queue locale avec verrou (un seul swap à la fois), traiter séquentiellement                                                                     |


#### 4. KYC invisible ? Pas tout à fait — RISQUE UX

Le plan promet "1 action = payer par CB". Mais au **premier achat**, l'utilisateur devra passer un KYC avec le provider on-ramp (Transak, Coinbase). C'est typiquement :

- Vérification d'identité (photo CNI/passeport)
- Selfie
- 2-10 minutes d'attente pour validation

Ce n'est pas "1 action" pour un nouvel utilisateur. C'est plus réaliste :

1. Choisir un Bundle
2. **KYC Transak/Coinbase (5-10 min, une seule fois)**
3. Payer par CB
4. Recevoir le Bundle

**Le KYC est incompressible** (obligation légale des providers). Mais il ne se fait qu'une fois — les achats suivants sont fluides.

**Mitigation UX** : Prévenir l'utilisateur AVANT le premier achat ("Vérification d'identité requise pour votre premier achat, ~5 minutes"). Ne pas le surprendre au milieu du flow.

---

### Coûts : Ce que le plan sous-estime


| Poste                  | Estimation du plan | Réalité                                                                | Impact                       |
| ---------------------- | ------------------ | ---------------------------------------------------------------------- | ---------------------------- |
| thirdweb après 12 mois | $5/mois            | **$0.01-0.015/MAU** → 10K users actifs = $135/mois, 100K = $1,500/mois | Significatif à l'échelle     |
| On-ramp                | ~1% (Transak ETH)  | **~1% (Transak ETH)**, flow simple et robuste pour le MVP              | +1€ par achat de 100€        |
| Audit UniversalRouter     | Non mentionné      | **$5,000-20,000** (audit cabinet spécialisé)                           | One-shot mais nécessaire     |
| API prix (Alchemy/Moralis fallback) | Gratuit | Alchemy : free tier generous. Moralis : free <25K req/mois. API serveur bundles : gratuit (infra propre) | Ok pour le MVP |


**Coût réaliste au lancement** : $0/mois + ~$5K-20K d'audit one-shot.
**Coût réaliste à 10K MAU** : ~$135/mois (thirdweb) + $99/an (Apple).

---

### Synthèse : Modifications au plan suite à l'audit


| Point                   | Avant                | Après                                                                                         |
| ----------------------- | -------------------- | --------------------------------------------------------------------------------------------- |
| On-ramp prioritaire     | Multiples hypothèses | **Transak ETH (~1%)** — scope MVP verrouillé sur l'ETH                                        |
| OTA updates Expo        | Activées (feature)   | **Désactivées en prod** — risque de supply chain attack sur un wallet crypto                  |
| Première utilisation    | "1 action"           | **KYC Transak + 1 action** — honnête sur le KYC obligatoire au 1er achat                      |
| Audit UniversalRouter      | Non mentionné        | **Obligatoire** avant déploiement (~$5-20K)                                                   |
| Résilience polling      | Non mentionné        | **Intention d'achat persistée en local** (AsyncStorage) + reprise au redémarrage              |
| Plan de sortie thirdweb | Non mentionné        | **Web3Auth comme alternative** si thirdweb devient trop cher (self-hostable, MetaMask-backed) |


---

## 9. Roadmap de Développement

### Phase 1 — MVP (6-8 semaines)


| Semaine | Tâche                                                                                   |
| ------- | --------------------------------------------------------------------------------------- |
| 1-2     | Setup Expo + thirdweb SDK + navigation de base + design system                          |
| 2-3     | Intégration In-App Wallet EOA (Google/Apple/Email login)                                |
| 3-4     | Écran Bundles (liste, underlyings, prix, courbe 1D/7D/1M/1Y) via The Graph + contracts  |
| 4-5     | Intégration fiat on-ramp via thirdweb Payments (Transak uniquement)                     |
| 5-6     | Intégration `../universal-router` pour quotes buy/sell + exécution trade                |
| 6-7     | Écran Trade (BUY/SELL) + écran Portfolio + historique transactions                      |
| 7-8     | Tests, polish UX, gestion d'erreurs, loading states                                     |


### Phase 2 — Production (4-6 semaines)


| Semaine | Tâche                                                                      |
| ------- | -------------------------------------------------------------------------- |
| 9-10    | Notifications push via Firebase Cloud Messaging (gratuit, pas de backend)  |
| 10-11   | Optimiser le flow on-ramp ETH (conversion, retries, analytics, monitoring) |
| 11-12   | Export clé privée + settings power users                                   |
| 12-13   | Tests E2E + audit sécurité wallet flows                                    |
| 13-14   | Soumission App Store + Google Play                                         |


### Phase 3 — Post-launch

- DCA automatique (upgrade vers ERC-4337 smart account + session keys si nécessaire)
- Support L2 (Base, Arbitrum)
- Off-ramp (vendre Bundle → CB)
- Widget Apple Watch / widgets home screen
- WalletConnect pour les power users

---

## 10. Mode d'exécution pour les IA (sans ambiguïté)

Les agents IA doivent exécuter ce plan tel quel, sans changer la portée MVP.

### 10.1 Portée verrouillée MVP

- 3 écrans uniquement: `Bundles`, `Trade`, `Portfolio`
- Vue Trade unique avec 2 modes (`CB -> Bundle` et `Swap Wallet`)
- On-ramp MVP: thirdweb Payments + Transak uniquement (Coinbase ajouté en Phase 2 via config, zéro code)
- Réseaux supportés MVP: Ethereum mainnet (`chainId: 1`) en production + Avalanche Fuji (`chainId: 43113`) pour test/preprod.
- Routing/pricing: réutilisation `../universal-router`, aucune logique de routing locale

### 10.2 Ressources obligatoires à réutiliser

- `../bundles-frontend` — **Patterns UI + data** :
  - `src/views/IndexListView.vue` → écran Bundles
  - `src/views/IndexView.vue` + `BuySellForm.vue` → écran Trade
  - `src/views/PortfolioView.vue` → écran Portfolio
  - `src/stores/protocol.store.ts` → logique état (adapter en Zustand)
  - `src/libraries/graph/` → queries The Graph
  - `src/models/` → types IndexToken, Position, Pool, Token, TokenHistory
  - `src/onchain/chains/ethereum.ts` → adresses contrats mainnet
  - `src/onchain/artifacts/1.0/` → ABIs de tous les contrats
  - `src/config/wagmi.ts` → config RPC + fallback
- `../universal-router` — **SDK pricing/routing** :
  - `src/production/bundleActions.ts` → `buyBundle`, `sellBundle`, `quoteBundles`
  - `src/config/addresses.ts` → toutes les adresses contrats (DEX, routers, WETH)
  - `src/contracts/abis.ts` → ABIs exportées
  - `src/examples/` → exemples d'utilisation (simulateBundleBuy/Sell, quoteBundles)
  - Package npm : `@bundlesfi/universal-router` (installer depuis tgz ou lien local)

### 10.3 Critères de done (obligatoires, vérifiables)

Chaque critère doit être vérifiable par un agent `/verifier` ou par une procédure reproductible (script, checklist). Pas de "ça a l'air OK".

#### Flows utilisateur (tests E2E ou manuels)

| Flow | Critère de succès | Comment vérifier |
| --- | --- | --- |
| Onboarding Google | Auth → wallet créé → écran Bundles affiché | Test Maestro : tap Google → assert écran Bundles visible |
| Onboarding Email | Auth → wallet créé → écran Bundles affiché | Test Maestro : saisir email → code → assert |
| Buy CB (Mode A) | EUR saisi → quote affichée → widget Transak s'ouvre | Test unitaire pour quote + test Maestro jusqu'au widget |
| Buy Swap (Mode B) | Bundle amount saisi → ETH cost affiché → tx envoyée → receipt success → position visible dans Portfolio | Test intégration avec mock RPC ou testnet |
| Sell (Mode B) | Bundle amount saisi → ETH proceeds affiché → approve + swap → receipt success → ETH visible dans Portfolio | Test intégration |
| Portfolio vide | User sans positions → EmptyState affiché + CTA fonctionne | Test Maestro |
| Portfolio avec positions | Positions affichées avec prix, quantité, PnL corrects | Test snapshot |
| Reprise après interruption | PurchaseIntent persisté → app tuée → relancée → intent détecté → flow reprend | Test unitaire PurchaseIntent + test manuel |
| Erreur réseau | RPC down → message d'erreur actionnable, pas de crash | Test avec mock réseau coupé |

#### Build production

- `eas build --profile production --platform ios` → exit code 0
- `eas build --profile production --platform android` → exit code 0
- Zero warnings TypeScript (`npx tsc --noEmit` → exit code 0)
- Zero erreurs ESLint (`npx eslint . --max-warnings 0`)

#### Sécurité (vérifiable par agent `/security-auditor`)

- `lib/contracts.ts` existe et contient TOUTES les adresses — aucune adresse hardcoded ailleurs
- `grep -r "privateKey\|secretKey\|mnemonic" src/` → 0 résultat (hors types/interfaces)
- `receipt.status` vérifié après chaque `sendTransaction` — pas d'exception
- OTA updates désactivées : `"updates": { "enabled": false }` dans `app.json`
- `npm audit --production` → 0 vulnérabilités critiques/high

#### Performance (seuils)

- Time to Interactive (écran Bundles) : < 3s sur réseau 4G
- Quote response (universal-router SDK) : < 2s
- Taille bundle JS : < 15 MB (vérifié dans EAS build logs)

#### Documentation

- `docs/ARCHITECTURE.md` existe et est à jour (structure dossiers, flux de données, décisions)
- Toutes les env vars documentées dans `.env.example`

### 10.4 Ce que les IA ne doivent pas faire

- Ajouter de nouvelles fonctionnalités hors MVP.
- Remplacer l'architecture de routing par une implémentation ad hoc.
- Introduire un backend applicatif non prévu.
- Changer de provider wallet sans décision explicite.

---

## Résumé Décisionnel


| Décision                  | Choix                                               | Raison principale                                                                                                                                                      |
| ------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**             | React Native (Expo)                                 | Écosystème web3 le plus riche, même langage que le web                                                                                                                 |
| **Wallet**                | thirdweb In-App Wallet                              | Social login, non-custodial, sharded keys, export possible                                                                                                             |
| **Architecture on-chain** | EOA + UniversalRouter (`0x1751F0...7c00`) | Buy: 1 tx (swapETHForExactTokens). Sell: approve + 1 tx. SDK `@bundlesfi/universal-router` pour les quotes. Gas ~$0.02-0.39/tx |
| **Stratégie gas**         | L'utilisateur paie le gas depuis l'ETH reçu         | ~$0.02-0.39 déduit de l'achat. Invisible pour l'utilisateur, zéro coût pour bundles.fi                                                                                 |
| **On-ramp**               | Transak ETH uniquement (MVP) | Un seul provider, zéro logique de fallback. Coinbase ajouté en Phase 2 via config thirdweb Payments                                                                    |
| **Backend**               | Aucun backend à développer                          | 100% client-side côté app. Réutilisation API bundles existante + The Graph + RPC thirdweb/viem. Zéro nouveau stockage serveur côté app |
| **Vues MVP**              | 3 écrans (Bundles, Trade Buy/Sell, Portfolio)       | Scope minimal, lisible, maintenable, orienté conversion                                                                                                                |
| **Pricing Engine**        | Réutilisation `universal-router`                    | Même logique quote/exécution que le front web, pas de duplication                                                                                                      |
| **Réseau**                | Ethereum L1 (prod) + Avalanche Fuji (test/preprod) | Mainnet pour production; Fuji pour validation préprod et tests de flows multichain                                                                                     |
| **UI**                    | NativeWind                                          | Cohérence avec patterns Tailwind du web, implémentation RN plus rapide, surface de maintenance réduite                                                                 |


### Coût estimé de l'infrastructure


| Service                                     | Coût                   | Notes                                                                                                                                                |
| ------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| thirdweb In-App Wallet                      | **$0**                 | Gratuit illimité (promo 12 mois). Ensuite : 1K MAU = gratuit, 10K MAU = $135/mois, 100K MAU = $1,500/mois. Plan de sortie : Web3Auth (self-hostable) |
| Gas (payé par l'utilisateur depuis son ETH) | **$0 pour bundles.fi** | ~$0.02-0.39 déduit de l'ETH acheté. Wallet EOA = pas d'overhead AA, pas de paymaster, pas de bundler                                                 |
| On-ramp (frais utilisateur)                 | **~1%**                | Transak ETH uniquement (~1%). Coinbase ajouté en Phase 2 via config                                                                                  |
| Backend                                     | **$0**                 | Aucun. Auth + key management + bundler + RPC = thirdweb. Prix = APIs publiques gratuites. Rien à héberger                                            |
| Expo EAS Build                              | **$0**                 | Plan gratuit = 15 builds/mois suffisant                                                                                                              |
| Apple Developer                             | $99/an                 | Incompressible                                                                                                                                       |
| Google Play                                 | $25 one-time           | Incompressible                                                                                                                                       |
| **Total récurrent (lancement)**             | **$0/mois**            | Seuls coûts fixes : stores ($99/an Apple + $25 Google). Le gas est à la charge de l'utilisateur (~0.2% du montant acheté)                            |


