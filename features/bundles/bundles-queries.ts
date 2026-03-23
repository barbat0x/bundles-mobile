import { useQuery, useQueries } from "@tanstack/react-query";

import type { SupportedChainId } from "@/lib/chains";
import { queryConfig } from "@/lib/query-config";
import { fetchTokenFindOne, fetchTokenHistory, type HistoryTimeframe } from "@/services/bundles-ws/token-api";
import { graphRequest } from "@/services/graph/bundles-graph-client";
import { graphIndexToBundle, type RawIndex } from "@/services/graph/parse-index";
import { FIND_INDEXES, GET_INDEX } from "@/services/graph/queries";
import type { BundleIndex, TokenStatistics } from "@/types";

type FindIndexesResult = { indexes: RawIndex[] };

export async function fetchBundleIndexesList(chainId: SupportedChainId): Promise<BundleIndex[]> {
  const res = await graphRequest<FindIndexesResult>(chainId, FIND_INDEXES, {
    first: 100,
    skip: 0,
    orderBy: "totalSupply",
    orderDirection: "desc",
  });
  return res.indexes.map((i) => graphIndexToBundle(i));
}

export function useBundleIndexesList(chainId: SupportedChainId): ReturnType<
  typeof useQuery<BundleIndex[], Error>
> {
  return useQuery({
    ...queryConfig.bundlesList(chainId),
    queryFn: () => fetchBundleIndexesList(chainId),
  });
}

export type EnrichedBundle = BundleIndex & { stats: TokenStatistics | null };

export function useEnrichedBundleList(
  bundles: BundleIndex[] | undefined,
  chainId: SupportedChainId,
): {
  isLoading: boolean;
  data: EnrichedBundle[];
} {
  const list = bundles ?? [];
  const queries = useQueries({
    queries: list.map((b) => ({
      ...queryConfig.tokenPrice(b.address, chainId),
      queryFn: async () => fetchTokenFindOne(b.address, chainId),
    })),
  });

  const isLoading = list.length > 0 && queries.some((q) => q.isLoading && !q.data);
  const data: EnrichedBundle[] = list.map((b, i) => ({
    ...b,
    stats: queries[i]?.data ?? null,
  }));

  return { isLoading, data };
}

export function useBundleDetail(address: string | undefined, chainId: SupportedChainId): ReturnType<
  typeof useQuery<BundleIndex | null, Error>
> {
  return useQuery({
    enabled: Boolean(address),
    ...queryConfig.bundleDetail(address ?? "", chainId),
    queryFn: async () => {
      if (!address) return null;
      const id = address.toLowerCase();
      const res = await graphRequest<{ index: RawIndex | null }>(chainId, GET_INDEX, { indexAddress: id });
      if (!res.index) return null;
      return graphIndexToBundle(res.index);
    },
  });
}

export function useTokenStatistics(
  tokenAddress: string | undefined,
  chainId: SupportedChainId,
): ReturnType<
  typeof useQuery<TokenStatistics | null, Error>
> {
  return useQuery({
    enabled: Boolean(tokenAddress),
    ...queryConfig.tokenPrice((tokenAddress ?? "0x") as `0x${string}`, chainId),
    queryFn: async () => {
      if (!tokenAddress) return null;
      return fetchTokenFindOne(tokenAddress, chainId);
    },
  });
}

export function usePriceHistory(
  tokenAddress: string | undefined,
  timeframe: HistoryTimeframe,
  chainId: SupportedChainId,
): ReturnType<typeof useQuery<{ priceUSD: number; createdAt: number }[], Error>> {
  return useQuery({
    enabled: Boolean(tokenAddress),
    ...queryConfig.tokenHistory((tokenAddress ?? "0x") as `0x${string}`, timeframe, chainId),
    queryFn: async () => {
      if (!tokenAddress) return [];
      const rows = await fetchTokenHistory(tokenAddress, timeframe, chainId);
      return rows.map((r) => ({
        priceUSD: r.priceUSD,
        createdAt: Date.parse(r.createdAt),
      }));
    },
  });
}

export function useWeekSparkline(tokenAddress: string | undefined, chainId: SupportedChainId): ReturnType<
  typeof useQuery<number[], Error>
> {
  return useQuery({
    enabled: Boolean(tokenAddress),
    queryKey: ["spark", chainId, tokenAddress ?? "", "week"],
    staleTime: 60_000,
    queryFn: async () => {
      if (!tokenAddress) return [];
      const rows = await fetchTokenHistory(tokenAddress, "week", chainId);
      return rows.map((r) => r.priceUSD);
    },
  });
}
