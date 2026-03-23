import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import type { SupportedChainId } from "@/lib/chains";
import { queryConfig } from "@/lib/query-config";
import { fetchTokenFindOne } from "@/services/bundles-ws/token-api";
import { graphRequest } from "@/services/graph/bundles-graph-client";
import { FIND_USER_DATA } from "@/services/graph/queries";
import type { Address } from "viem";
import type { TokenStatistics, UserPosition } from "@/types";

type RawIndexRow = {
  address: string;
  name: string;
  symbol: string;
  decimals: string;
  totalSupply: string;
};

type Row = {
  balance: string;
  index: RawIndexRow;
};

type GraphUser = { userIndexBalances: Row[] };

function rawToUserPosition(row: Row): UserPosition {
  const index = row.index;
  const addr = index.address.toLowerCase() as Address;
  return {
    bundleAddress: addr,
    balance: BigInt(row.balance),
    index: {
      address: addr,
      name: index.name,
      symbol: index.symbol,
      decimals: Number(index.decimals),
    },
  };
}

export function useUserPositions(
  walletAddress: string | undefined,
  chainId: SupportedChainId,
): ReturnType<
  typeof useQuery<UserPosition[], Error>
> {
  return useQuery({
    enabled: Boolean(walletAddress),
    ...queryConfig.userPositions((walletAddress ?? "").toLowerCase(), chainId),
    queryFn: async () => {
      const res = await graphRequest<GraphUser>(chainId, FIND_USER_DATA, {
        user: walletAddress!.toLowerCase(),
        first: 50,
        skip: 0,
      });
      return res.userIndexBalances.map(rawToUserPosition);
    },
  });
}

export type PositionRow = UserPosition & { stats: TokenStatistics | null; valueUsd: number; pnlUsd: number };

export function useEnrichedPositions(
  positions: UserPosition[] | undefined,
  chainId: SupportedChainId,
): { rows: PositionRow[]; isLoading: boolean } {
  const q = useQuery({
    enabled: Boolean(positions?.length),
    queryKey: ["portfolio", "enriched", chainId, positions?.map((p) => p.bundleAddress).join(",")],
    queryFn: async () => {
      if (!positions?.length) return [];
      const enriched: PositionRow[] = [];
      for (const p of positions) {
        const stats = await fetchTokenFindOne(p.bundleAddress, chainId);
        const price = stats?.priceUSD ?? 0;
        const d = p.index.decimals;
        const human = Number(p.balance) / 10 ** d;
        const valueUsd = human * price;
        const day = stats?.priceVariations?.lastDay ?? 0;
        const priceYesterday = price / (1 + day / 100);
        const valueYesterday = human * priceYesterday;
        const pnlUsd = valueUsd - valueYesterday;
        enriched.push({
          ...p,
          stats,
          valueUsd,
          pnlUsd,
        });
      }
      return enriched;
    },
  });
  const rows = useMemo(() => q.data ?? [], [q.data]);
  return { rows, isLoading: q.isLoading };
}

/** Total portfolio USD from enriched rows */
export function sumPortfolioUsd(rows: PositionRow[]): number {
  return rows.reduce((s, r) => s + r.valueUsd, 0);
}
