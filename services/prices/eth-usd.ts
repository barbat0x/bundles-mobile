import { t } from "@/lib/i18n";

/** Public ETH/USD rate from CoinGecko for post on-ramp USD reserve logic. */
export async function fetchEthUsdCoingecko(): Promise<number> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) throw new Error(t("errors.ethUsdRateUnavailable"));
  const body = (await res.json()) as { ethereum?: { usd?: number } };
  const usd = body.ethereum?.usd;
  if (typeof usd !== "number" || !Number.isFinite(usd) || usd <= 0) {
    throw new Error(t("errors.ethUsdParseError"));
  }
  return usd;
}

let ethUsdCache: { expires: number; usd: number } | null = null;

/** Throttle CoinGecko calls while Mode A polling runs every ~5s. */
export async function fetchEthUsdCoingeckoCached(ttlMs = 60_000): Promise<number> {
  const now = Date.now();
  if (ethUsdCache && ethUsdCache.expires > now) return ethUsdCache.usd;
  const usd = await fetchEthUsdCoingecko();
  ethUsdCache = { expires: now + ttlMs, usd };
  return usd;
}
