import type { Address } from "viem";
import type { SupportedChainId } from "@/lib/chains";

/** PLAN §6.6 — TanStack Query timings */
export const queryConfig = {
  bundlesList: (chainId: SupportedChainId) =>
    ({
      queryKey: ["bundles", "list", chainId] as const,
      staleTime: 30_000,
      refetchOnWindowFocus: true,
    }) as const,
  bundleDetail: (address: string, chainId: SupportedChainId) =>
    ({
      queryKey: ["bundles", "detail", chainId, address] as const,
      staleTime: 15_000,
    }) as const,
  userPositions: (userAddress: string, chainId: SupportedChainId) =>
    ({
      queryKey: ["portfolio", chainId, userAddress.toLowerCase()] as const,
      staleTime: 10_000,
      refetchInterval: 10_000,
    }) as const,
  tokenPrice: (tokenAddress: Address, chainId: SupportedChainId) =>
    ({
      queryKey: ["token", "price", chainId, tokenAddress.toLowerCase()] as const,
      staleTime: 30_000,
    }) as const,
  tokenHistory: (tokenAddress: Address, timeframe: string, chainId: SupportedChainId) =>
    ({
      queryKey: ["token", "history", chainId, tokenAddress.toLowerCase(), timeframe] as const,
      staleTime: 60_000,
    }) as const,
  quote: (bundleAddress: Address, amount: string, side: "buy" | "sell", chainId: SupportedChainId) =>
    ({
      queryKey: ["quote", chainId, bundleAddress.toLowerCase(), amount, side] as const,
      staleTime: 5_000,
      gcTime: 10_000,
    }) as const,
} as const;
