import type { Address } from "viem";

import type { BundleAsset, BundleIndex } from "@/types";

export type RawToken = {
  address: string;
  name: string;
  symbol: string;
  decimals: string;
};

export type RawAsset = {
  token: RawToken;
  startWeight: string;
  endWeight: string;
  balance: string;
};

export type RawIndex = {
  address: string;
  name: string;
  symbol: string;
  decimals: string;
  totalSupply: string;
  swapFee?: string;
  mintBurnFee?: string;
  holderCount?: string;
  assets: RawAsset[];
};

function parseBigIntStr(s: string): bigint {
  return BigInt(s);
}

export function graphIndexToBundle(raw: RawIndex): BundleIndex {
  const assets: BundleAsset[] = raw.assets.map((a) => ({
    tokenAddress: a.token.address.toLowerCase() as Address,
    name: a.token.name,
    symbol: a.token.symbol,
    decimals: Number(a.token.decimals),
    startWeight: parseBigIntStr(a.startWeight),
    endWeight: parseBigIntStr(a.endWeight),
    balance: parseBigIntStr(a.balance),
  }));

  return {
    address: raw.address.toLowerCase() as Address,
    name: raw.name,
    symbol: raw.symbol,
    decimals: Number(raw.decimals),
    totalSupply: parseBigIntStr(raw.totalSupply),
    holderCount: raw.holderCount ? Number(raw.holderCount) : 0,
    swapFee: raw.swapFee ? Number(raw.swapFee) : 0,
    mintBurnFee: raw.mintBurnFee ? Number(raw.mintBurnFee) : 0,
    assets,
  };
}
