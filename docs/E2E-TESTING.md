# Parcours **fiat → ETH → bundle** (onglet Carte, Ethereum)

Périmètre : **uniquement** ce flux dans l’app (Thirdweb Pay → Transak → crédit ETH → achat bundle).  
Pas les tests « swap seulement » ni Fuji ici — voir fin de page si besoin.

---

## Contrainte Transak (staging)

En [mode test / staging](https://docs.transak.com/docs/test-credentials), Transak indique qu’il **n’envoie pas** les **tokens natifs** (ETH sur Ethereum, etc.) tout en pouvant marquer l’ordre comme réussi.

Donc pour le **même enchaînement que la prod** (carte → ETH qui arrive → bundle), le sandbox **ne suffit pas** à garantir l’étape « ETH reçu ».

---

## Option A — Alignée prod (seule qui reproduit tout le chemin)

| | |
|--|--|
| **Env** | `EXPO_PUBLIC_THIRDWEB_PAY_TEST_MODE=false` (ou variable absente) |
| **Réseau** | **Ethereum** dans l’app |
| **Parcours** | **Carte** → paiement Transak réel → attente ETH sur le wallet → swap / intent bundle |
| **Montant** | **Minimum** acceptable par l’équipe (petit achat fiat réel) |

C’est le **seul** scénario documenté ici qui teste **de bout en bout** le parcours **fiat → ETH → bundle** comme un utilisateur final.

---

## Option B — Sandbox fiat (`TEST_MODE=true`)

| | |
|--|--|
| **Env** | `EXPO_PUBLIC_THIRDWEB_PAY_TEST_MODE=true` |
| **Réseau** | **Ethereum** |
| **Parcours** | **Carte** → widget Transak staging → cartes de test ([doc](https://docs.transak.com/docs/test-credentials)) |

**Utile pour** : UX carte, KYC dummy, redirection, **statuts intent** Thirdweb / Transak.

**Limite pour ce périmètre** : tu ne peux **pas** t’attendre à un **E2E identique à la prod** (ETH natif crédité puis bundle), car la doc Transak exclut l’envoi de natifs en staging. Tu valides surtout l’**intégration** du parcours fiat, pas la suite « ETH réel → bundle » dans les mêmes conditions que la prod.

---

## Approche en **2 étapes** (recommandée pour l’équipe)

L’app enchaîne ainsi (voir `features/trade/trade-screen.tsx`) :

1. Intent sauvegardé en `payment_pending` après ouverture du lien on-ramp.
2. Tant que `getBuyWithFiatStatus` ne renvoie pas **`ON_RAMP_TRANSFER_COMPLETED`**, l’intent reste en attente paiement.
3. Dès ce statut → passage en **`funds_pending`**.
4. La phase **ETH → bundle** ne part **que si** le solde natif du wallet `>= expectedEthCost` (wei) — puis **swap auto** via `executeBuy`.

### Étape 1 — Paiement CB sandbox (Thirdweb + Transak)

- `EXPO_PUBLIC_THIRDWEB_PAY_TEST_MODE=true`, **Ethereum**, onglet **Carte**, carte de test Transak.
- Objectif : valider **widget, redirection, intent,** et idéalement que l’API Thirdweb fasse bien passer le statut à **`ON_RAMP_TRANSFER_COMPLETED`** (comportement dépendant du staging Transak / intent).

### Étape 2 — « Simuler » la réception d’ETH + tester le **swap auto**

Transak ne crédite en général **pas** d’ETH natif en staging. Pour tester **la même logique que la prod** pour la **deuxième moitié** du flux (détection solde → déclenchement `executeBuy`) :

1. Laisser l’intent arriver en **`funds_pending`** (après `ON_RAMP_TRANSFER_COMPLETED` à l’étape 1).
2. **Envoyer manuellement** sur l’adresse du wallet in-app un montant d’**ETH mainnet ≥ `expectedEthCost`** (tu peux lire la valeur côté quote / intent persisté — champ `expectedEthCost` dans le stockage local).
3. L’app poll le solde toutes les ~5 s : dès la condition remplie, **le swap bundle se lance tout seul** (même code que si l’ETH venait de Transak).

**En résumé** : étape 1 = **parcours carte + statuts** ; étape 2 = **simulation de l’arrivée des fonds** par un **virement ETH réel minimal** depuis un wallet dev, ce qui déclenche la **phase auto** identique à la prod.

### Si le sandbox ne passe jamais à `ON_RAMP_TRANSFER_COMPLETED`

Sans ce statut, l’intent ne passe pas à `funds_pending` et l’étape 2 ne peut pas s’enchaîner **avec le même intent**. Dans ce cas : soit creuser avec **Transak / Thirdweb** pourquoi le staging ne complète pas le statut, soit faire un **mini achat réel** (`TEST_MODE=false`) pour obtenir un flux de statut + ETH réels, soit accepter de ne tester la **phase 2** qu’avec un intent obtenu autrement (hors scope doc courte).

---

## Résumé (fiat → ETH → bundle uniquement)

| Objectif | Réglage |
|----------|---------|
| **Tester comme en prod** (fiat → ETH → bundle) | `TEST_MODE=false`, petit montant réel, Ethereum |
| **Tester le parcours carte / provider sans débit** | `TEST_MODE=true`, cartes Transak staging |
| **Sandbox CB puis swap auto comme la prod** | Étape 1 `TEST_MODE=true` + étape 2 envoi ETH manuel ≥ `expectedEthCost` une fois en `funds_pending` |

**Thirdweb** : Client ID avec domaines autorisés pour ton build / `localhost`.

---

## Réserve ETH après on-ramp (mainnet)

Sur **Ethereum**, avant le swap auto post-CB, l’app applique une réserve d’environ **`POST_ONRAMP_RESERVE_USD` (2 $)** en ETH (taux CoinGecko, cache 60 s) en plus du buffer gas : si l’achat « plein intent » la consommerait tout, le **montant de tokens bundle est réduit** pour laisser ~2 $ d’ETH sur le wallet (ventes / txs futures). Si CoinGecko échoue, repli **~0,001 ETH**.

---

## Alignement `bundles-frontend` (slippage + « fonds prêts »)

Sur le web, `BuySellForm.vue` exige pour un **buy** :

- solde ≥ `ethCost` du quote, **et**
- solde ≥ `getAmountWithSlippageUp(ethCost)` (marge **max-in** identique au `msg.value` du router).

L’app mobile applique la **même idée** pour débloquer l’auto-swap après on-ramp : re-**quote** `buyBundle` en continu en `funds_pending`, puis `maxEthIn = ethCost + slippage` (bps utilisateur), et le solde doit couvrir **maxEthIn + petit buffer gas** (EOA : le même ETH sert au swap et au gas — un wallet à « 100 % » sauf marge gas peut encore échouer si le buffer est trop bas ; ajuster `getModeAGasBufferWei` si besoin).

---

## Hors périmètre (autres flux)

- **Fuji + Wallet** : teste swap bundle **sans** étape fiat — utile pour le router, pas pour *ce* parcours.
- **Envoyer de l’ETH à la main** puis Wallet : ne teste **pas** l’on-ramp carte.
