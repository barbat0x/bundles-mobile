import type { Chain as ThirdwebChain } from "thirdweb/chains";
import { avalancheFuji as twAvalancheFuji, ethereum as twEthereum } from "thirdweb/chains";
import type { Chain as ViemChain } from "viem/chains";
import { avalancheFuji as viemAvalancheFuji, mainnet as viemMainnet } from "viem/chains";

import { type SupportedChainId } from "@/lib/chains";

export function getViemChain(chainId: SupportedChainId): ViemChain {
  return chainId === 43113 ? viemAvalancheFuji : viemMainnet;
}

export function getThirdwebChain(chainId: SupportedChainId): ThirdwebChain {
  return chainId === 43113 ? twAvalancheFuji : twEthereum;
}
