import { createPublicClient, fallback, http } from "viem";

import { getChainConfig, type SupportedChainId } from "@/lib/chains";
import { getViemChain } from "@/lib/chain-runtime";
import { getEnv } from "@/lib/env";

/**
 * viem public client — primary thirdweb RPC + PLAN §6.7.3 fallback.
 * Used by @bundlesfi/universal-router (quotes) and readContract paths.
 */
export function createViemPublicClient(thirdwebClientId: string, chainId: SupportedChainId) {
  const env = getEnv();
  const chain = getViemChain(chainId);
  const fallbackRpc = getChainConfig(chainId).id === 1 ? env.EXPO_PUBLIC_RPC_FALLBACK_URL : chain.rpcUrls.default.http[0];
  const primary = `https://${chain.id}.rpc.thirdweb.com/${thirdwebClientId}`;

  return createPublicClient({
    chain,
    transport: fallback(
      [http(primary, { timeout: 15_000 }), http(fallbackRpc, { timeout: 15_000 })],
      { rank: false, retryCount: 2 },
    ),
  });
}
