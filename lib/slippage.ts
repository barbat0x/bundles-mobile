/**
 * Slippage helpers aligned with bundles-frontend `ExchangeRouter`:
 * - `getAmountWithSlippageDown`: out_min = amount - amount * (tolerance% * 100) / 10_000
 * - `getAmountWithSlippageUp`: in_max = amount + amount * (tolerance% * 100) / 10_000
 *
 * Here we express tolerance in basis points of notional (1 bps = 0.01%),
 * so `tolerancePercent * 100` from frontend equals `slippageBps`.
 */

export const SLIPPAGE_BPS_MIN = 1;
export const SLIPPAGE_BPS_MAX = 200;
/** 0.5% — matches `ExchangeRouter.defaultSlippageTolerance` on web */
export const DEFAULT_SLIPPAGE_BPS = 50;

export function clampSlippageBps(n: number): number {
  if (!Number.isFinite(n) || n < SLIPPAGE_BPS_MIN) return DEFAULT_SLIPPAGE_BPS;
  return Math.min(SLIPPAGE_BPS_MAX, Math.floor(n));
}

/** Safe bigint slippage for on-chain math (sell min-out / buy max-in). */
export function toSlippageBpsBigint(bps: bigint | undefined, fallback: bigint): bigint {
  const v = bps ?? fallback;
  if (v < 1n || v > BigInt(SLIPPAGE_BPS_MAX)) {
    throw new Error("Slippage hors plage");
  }
  return v;
}

export function amountMinAfterSlippage(amount: bigint, bps: bigint): bigint {
  return amount - (amount * bps) / 10000n;
}

export function amountMaxAfterSlippageUp(amount: bigint, bps: bigint): bigint {
  return amount + (amount * bps) / 10000n;
}
