import type { SupportedChainId } from "@/lib/chains";
import type { TokenStatistics } from "@/types";

import { globalWsClient } from "./bundles-ws-client";

/** Server payload inside WS `data` field (PLAN §6.7.1). */
type TokensFindOnePayload = { code: number; data?: { statistics?: TokenStatistics } };

export async function fetchTokenFindOne(
  tokenAddress: string,
  chainId: SupportedChainId,
): Promise<TokenStatistics | null> {
  const raw = await globalWsClient.request<TokensFindOnePayload>("tokens:findOne", {
    tokenAddress,
    chainId,
  });
  return raw?.data?.statistics ?? null;
}

export type HistoryTimeframe = "day" | "week" | "month" | "year" | "all";

type HistoryPayload = { code: number; data?: { priceUSD: number; createdAt: string }[] };

export async function fetchTokenHistory(
  tokenAddress: string,
  timeframe: HistoryTimeframe,
  chainId: SupportedChainId,
): Promise<{ priceUSD: number; createdAt: string }[]> {
  const raw = await globalWsClient.request<HistoryPayload>("tokens:getHistory", {
    chainId,
    tokenAddress,
    timeframe,
  });
  return raw?.data ?? [];
}
