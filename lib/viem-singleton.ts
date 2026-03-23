import type { PublicClient } from "viem";

import { DEFAULT_CHAIN_ID, type SupportedChainId } from "@/lib/chains";
import { createViemPublicClient } from "@/lib/public-client";
import { getEnv } from "@/lib/env";

const cached = new Map<SupportedChainId, PublicClient>();

export function getViemPublicClient(chainId: SupportedChainId = DEFAULT_CHAIN_ID): PublicClient {
  const existing = cached.get(chainId);
  if (existing) return existing;

  const client = createViemPublicClient(getEnv().EXPO_PUBLIC_THIRDWEB_CLIENT_ID, chainId);
  cached.set(chainId, client);
  return client;
}

export function clearViemClients(): void {
  cached.clear();
}
