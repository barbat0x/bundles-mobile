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

/** After card purchase -> ETH (mainnet), keep roughly this USD amount in ETH for gas and later sells. */
export const POST_ONRAMP_RESERVE_USD = 2;

/**
 * Heuristic: balance should cover swap `msg.value` (max ETH input) plus gas margin
 * from the same EOA account. Without that margin, a user may see `funds_ready = true`
 * while transaction still fails due to gas shortage.
 * This is intentionally lighter than repeated on-chain estimateGas calls.
 */
export function getModeAGasBufferWei(chainId: number): bigint {
  if (chainId === 1) return 2n * 10n ** 15n; // ~0.002 ETH
  if (chainId === 43113) return 1n * 10n ** 17n; // 0.1 AVAX — largement suffisant sur Fuji
  return 2n * 10n ** 15n;
}
