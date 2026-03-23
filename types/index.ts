import type { Address } from "viem";

export type BundleAsset = {
  tokenAddress: Address;
  name: string;
  symbol: string;
  decimals: number;
  startWeight: bigint;
  endWeight: bigint;
  balance: bigint;
};

export type BundleIndex = {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  holderCount: number;
  swapFee: number;
  mintBurnFee: number;
  assets: BundleAsset[];
};

export type TokenStatistics = {
  priceUSD: number;
  priceVariations?: {
    lastHour?: number;
    lastDay?: number;
    lastWeek?: number;
    lastMonth?: number;
  };
};

export type UserPosition = {
  bundleAddress: Address;
  balance: bigint;
  index: Pick<BundleIndex, "address" | "name" | "symbol" | "decimals">;
};

export type PricePoint = { priceUSD: number; createdAt: number };
