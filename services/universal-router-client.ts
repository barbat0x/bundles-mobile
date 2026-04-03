import {
  buyBundle as buyBundleSdk,
  quoteBundles as quoteBundlesSdk,
  sellBundle as sellBundleSdk,
  type RouteHints,
} from "@bundlesfi/universal-router";
import type { Address, PublicClient } from "viem";

type TradeOpts = Parameters<typeof buyBundleSdk>[3];

const defaultRouteHints: RouteHints = new Map([
  [
    "0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c",
    ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"],
  ],
]);

function withDefaultRouteHints(config?: TradeOpts): TradeOpts {
  return {
    ...config,
    routeHints: config?.routeHints ?? defaultRouteHints,
  };
}

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
  return buyBundleSdk(publicClient as never, bundleAddress, amount, withDefaultRouteHints(config));
}

export function sellBundle(
  publicClient: PublicClient,
  bundleAddress: Address,
  amount: bigint,
  config?: TradeOpts,
): ReturnType<typeof sellBundleSdk> {
  return sellBundleSdk(publicClient as never, bundleAddress, amount, withDefaultRouteHints(config));
}

type QuoteOpts = Parameters<typeof quoteBundlesSdk>[2];

export function quoteBundles(
  publicClient: PublicClient,
  bundleAddresses: Address[],
  config?: QuoteOpts,
): ReturnType<typeof quoteBundlesSdk> {
  return quoteBundlesSdk(publicClient as never, bundleAddresses, config);
}
