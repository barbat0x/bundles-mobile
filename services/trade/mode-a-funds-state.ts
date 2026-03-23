import type { Address, PublicClient } from "viem";
import { parseUnits } from "viem";

import { TX_DEADLINE_SECONDS } from "@/lib/contracts";
import { amountMaxAfterSlippageUp } from "@/lib/slippage";
import { buyBundle } from "@/services/universal-router-client";

export type ModeAFundsCheckResult = {
  /** Whether a non-zero bundle buy can be executed safely. */
  ready: boolean;
  /** Bundle output amount (wei) used by swap/execute buy flows. */
  bundleOutWei: bigint;
};

/** Convert a USD reserve target into ETH wei. */
export function ethWeiFromUsdReserve(usd: number, ethPriceUsd: number): bigint {
  if (usd <= 0 || ethPriceUsd <= 0) return 0n;
  const eth = usd / ethPriceUsd;
  const s = eth.toFixed(18);
  return parseUnits(s as `${number}`, 18);
}

/**
 * Finds the largest `amountOut` <= `targetOut` such that max ETH in
 * (quote + slippage) stays <= `ceilingEthWei`.
 */
export async function findMaxAffordableBundleOut(args: {
  publicClient: PublicClient;
  bundleAddress: Address;
  targetOut: bigint;
  slippageBps: bigint;
  /** Max allowed value for `amountMaxAfterSlippageUp(ethCost)`. */
  ceilingEthWei: bigint;
}): Promise<bigint> {
  const { publicClient, bundleAddress, targetOut, slippageBps, ceilingEthWei } = args;
  const deadline = BigInt(TX_DEADLINE_SECONDS);

  if (targetOut <= 0n || ceilingEthWei <= 0n) return 0n;

  const needFor = async (out: bigint): Promise<bigint> => {
    const q = await buyBundle(publicClient, bundleAddress, out, { deadline });
    return amountMaxAfterSlippageUp(q.ethCost, slippageBps);
  };

  if ((await needFor(targetOut)) <= ceilingEthWei) return targetOut;

  let amt = (targetOut * 9n) / 10n;
  let found = 0n;
  for (let i = 0; i < 28 && amt > 0n; i++) {
    const need = await needFor(amt);
    if (need <= ceilingEthWei) {
      found = amt;
      break;
    }
    amt = (amt * 95n) / 100n;
  }

  if (found === 0n) return 0n;

  let lo = found;
  let hi = targetOut;
  while (lo < hi) {
    const mid = (lo + hi + 1n) / 2n;
    const need = await needFor(mid);
    if (need <= ceilingEthWei) lo = mid;
    else hi = mid - 1n;
  }
  return lo;
}

/** Compute Mode A funds state with gas and reserve constraints. */
export async function computeModeAFundsState(args: {
  publicClient: PublicClient;
  bundleAddress: Address;
  targetBundleOutWei: bigint;
  slippageBps: bigint;
  balanceWei: bigint;
  gasBufferWei: bigint;
  /** ETH reserve kept in wallet (0 when not applicable). */
  spendReserveWei: bigint;
}): Promise<ModeAFundsCheckResult> {
  const {
    balanceWei,
    gasBufferWei,
    spendReserveWei,
    publicClient,
    bundleAddress,
    targetBundleOutWei,
    slippageBps,
  } = args;
  const ceiling = balanceWei - gasBufferWei - spendReserveWei;
  if (ceiling <= 0n) {
    return { ready: false, bundleOutWei: 0n };
  }

  const bundleOutWei = await findMaxAffordableBundleOut({
    publicClient,
    bundleAddress,
    targetOut: targetBundleOutWei,
    slippageBps,
    ceilingEthWei: ceiling,
  });

  return {
    ready: bundleOutWei > 0n,
    bundleOutWei,
  };
}
