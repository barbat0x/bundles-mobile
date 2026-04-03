import type { Address } from "viem";
import { formatUnits } from "viem";

/** PLAN §5.7 formatting table */
export function formatCompactUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return formatUsd(n);
}

export function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatFiatAmount(n: number, currency: string, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatEurFr(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatPct(variation: number | undefined): { text: string; positive: boolean } {
  if (variation === undefined || Number.isNaN(variation)) {
    return { text: "—", positive: true };
  }
  const sign = variation >= 0 ? "+" : "";
  return { text: `${sign}${variation.toFixed(2)}%`, positive: variation >= 0 };
}

export function formatEthFromWei(wei: bigint): string {
  const eth = Number.parseFloat(formatUnits(wei, 18));
  const s = Number.isFinite(eth) ? eth.toPrecision(6) : "0";
  return `${s} ETH`;
}

export function formatBundleAmount(units: number, symbol: string): string {
  return `${units.toFixed(4)} ${symbol}`;
}

export function formatWeightPercent(weightWei: bigint, totalWeightWei: bigint): string {
  if (totalWeightWei <= 0n) return "0%";
  const scaled = (weightWei * 10_000n) / totalWeightWei;
  const integer = scaled / 100n;
  const decimals = scaled % 100n;
  return `${integer.toString()}.${decimals.toString().padStart(2, "0")}%`;
}

export function truncateAddress(addr: Address): string {
  const a = addr as string;
  if (a.length < 10) return a;
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}
