import { request } from "graphql-request";

import { getChainConfig, type SupportedChainId } from "@/lib/chains";
import { getEnv } from "@/lib/env";

export function getGraphUrl(chainId: SupportedChainId): string {
  const key = getEnv().EXPO_PUBLIC_GRAPH_API_KEY;
  const subgraphId = getChainConfig(chainId).graphSubgraphId;
  return `https://gateway.thegraph.com/api/${key}/subgraphs/id/${subgraphId}`;
}

export async function graphRequest<T>(
  chainId: SupportedChainId,
  document: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const url = getGraphUrl(chainId);
  const execute = () => request<T>(url, document, variables);
  try {
    return await execute();
  } catch {
    await new Promise((r) => setTimeout(r, 2000));
    return await execute();
  }
}
