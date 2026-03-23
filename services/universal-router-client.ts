import {
  buyBundle as buyBundleSdk,
  quoteBundles as quoteBundlesSdk,
  sellBundle as sellBundleSdk,
} from "@bundlesfi/universal-router";
import type { Address, PublicClient } from "viem";

type TradeOpts = Parameters<typeof buyBundleSdk>[3];

/**
 * Linked `@/bundlesfi/universal-router` may resolve its own `viem` copy; `PublicClient` types then diverge.
 * Runtime client is correct — narrow at the boundary only.
 */
export function buyBundle(
  publicClient: PublicClient,
  bundleAddress: Address,
  amount: bigint,
  config?: TradeOpts,
): ReturnType<typeof buyBundleSdk> {
  return buyBundleSdk(publicClient as never, bundleAddress, amount, config);
}

export function sellBundle(
  publicClient: PublicClient,
  bundleAddress: Address,
  amount: bigint,
  config?: TradeOpts,
): ReturnType<typeof sellBundleSdk> {
  return sellBundleSdk(publicClient as never, bundleAddress, amount, config);
}

type QuoteOpts = Parameters<typeof quoteBundlesSdk>[2];

export function quoteBundles(
  publicClient: PublicClient,
  bundleAddresses: Address[],
  config?: QuoteOpts,
): ReturnType<typeof quoteBundlesSdk> {
  return quoteBundlesSdk(publicClient as never, bundleAddresses, config);
}
