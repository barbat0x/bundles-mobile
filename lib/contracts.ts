import { DEFAULT_CHAIN_ID, getChainConfig, type SupportedChainId } from "@/lib/chains";

/** Backward-compatible alias for current default chain. */
export const CHAIN_ID = DEFAULT_CHAIN_ID;

/** Backward-compatible alias for default-chain contracts. */
export const CONTRACTS = getChainConfig(DEFAULT_CHAIN_ID).contracts;

export type ContractName = keyof typeof CONTRACTS;

export function getContracts(chainId: SupportedChainId) {
  return getChainConfig(chainId).contracts;
}

/** Default slippage (50 bps = 0.5%) — aligned with bundles-frontend */
export const SLIPPAGE_BPS = 50n;

export const TX_DEADLINE_SECONDS = 300;

/** Après achat CB → ETH (mainnet), on évite de tout passer en bundle pour laisser ~ce montant en USD en ETH pour gas / ventes. */
export const POST_ONRAMP_RESERVE_USD = 2;

/**
 * Heuristique : le solde doit couvrir `msg.value` (max ETH du swap) **+** une marge pour le **gas**
 * (même compte EOA). Sinon un utilisateur qui « met 100 % » de son ETH via on-ramp peut voir
 * le gate `funds_ready` à true alors que la tx échoue faute de gas.
 * Pas un estimateGas on-chain (trop lourd à poller) — à ajuster si besoin.
 */
export function getModeAGasBufferWei(chainId: number): bigint {
  if (chainId === 1) return 2n * 10n ** 15n; // ~0.002 ETH
  if (chainId === 43113) return 1n * 10n ** 17n; // 0.1 AVAX — largement suffisant sur Fuji
  return 2n * 10n ** 15n;
}
