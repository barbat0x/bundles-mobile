import type { Address } from "viem";

export type SupportedChainId = 1 | 43113;

export type ProtocolContracts = {
  factory: Address;
  routerBundlesSwap: Address;
  protocolToken: Address;
  exchangePosition: Address;
  exchangeFactory: Address;
  universalRouter: Address;
  staking: Address;
  weth: Address;
};

export type ChainConfig = {
  id: SupportedChainId;
  shortName: string;
  name: string;
  nativeSymbol: string;
  graphSubgraphId: string;
  explorerTxBaseUrl: string;
  assetsChainFolderId: number;
  contracts: ProtocolContracts;
};

export const DEFAULT_CHAIN_ID: SupportedChainId = 1;

export const CHAIN_CONFIGS: Record<SupportedChainId, ChainConfig> = {
  1: {
    id: 1,
    shortName: "Ethereum",
    name: "Ethereum",
    nativeSymbol: "ETH",
    graphSubgraphId: "9XrX1raUFtuEksCevfvYhNUpiyiKEuqxQXcbBzFfnVkY",
    explorerTxBaseUrl: "https://etherscan.io/tx/",
    assetsChainFolderId: 1,
    contracts: {
      universalRouter: "0x1751F0eADFeB3d618B9e4176edDC9E7D24657c00",
      factory: "0x209bE93480e23CA0876d5f9D6fbBD61490173f04",
      routerBundlesSwap: "0x6b8Cd00Eeff2e8D9f563869B068D9C64EF1Dd791",
      protocolToken: "0x695f775551fb0D28b64101c9507c06F334b4bA86",
      exchangePosition: "0xC2b84f1F3B0b56c26A15C84aE3191cf487a28a8c",
      exchangeFactory: "0xAcff9eee0a5522000E7141b77107359A6462E8d2",
      staking: "0x03ae8f37d0Fbe54EcEcD59382cd7991f42FceBd0",
      weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    },
  },
  43113: {
    id: 43113,
    shortName: "Avalanche Fuji",
    name: "Avalanche Testnet C-Chain",
    nativeSymbol: "AVAX",
    graphSubgraphId: "EhCcsqpEyd4pbuoQtVNwFL5vU2aGCzrYakEYxwYjZqBj",
    explorerTxBaseUrl: "https://subnets-test.avax.network/c-chain/tx/",
    assetsChainFolderId: 43113,
    contracts: {
      universalRouter: "0x8924D73C4ef200C6c12EAfB068Ab717f105B0608",
      factory: "0x3cE1A83208238C846847D3fFdAC01F035869AF49",
      routerBundlesSwap: "0x63147AC353A063eB01bA65F104b0a065a0643B7e",
      protocolToken: "0xCe1b3739c0620f9a3c633CFfA197cA7B1795D6d7",
      exchangePosition: "0x15EED00843C664BF729f89597D492C2Aea0bEd06",
      exchangeFactory: "0xFb544794ca6C9E1F3f305547AB27AaE837d48E21",
      staking: "0x9B08550320fe69D270dCA39d2b50C4aD16A0Dd01",
      weth: "0xd00ae08403b9bbb9124bb305c09058e32c39a48c",
    },
  },
};

export const SUPPORTED_CHAINS = Object.values(CHAIN_CONFIGS);
export const ONRAMP_ENABLED_CHAINS: SupportedChainId[] = [1];

export function isSupportedChainId(chainId: number): chainId is SupportedChainId {
  return chainId in CHAIN_CONFIGS;
}

export function getChainConfig(chainId: SupportedChainId): ChainConfig {
  return CHAIN_CONFIGS[chainId];
}

export function isOnRampEnabledChain(chainId: SupportedChainId): boolean {
  return ONRAMP_ENABLED_CHAINS.includes(chainId);
}
