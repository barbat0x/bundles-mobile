/**
 * ETH ↔ fiat reference rate for Mode A UI estimates.
 * PLAN §6.5.1 cites Alchemy/Moralis for token USD; bundles WS has no EUR/ETH in §6.7.5.
 * Minimal option: public CoinGecko `simple/price` (no API key). If this fails, callers should surface quote_error.
 *
 * @param vsCurrency CoinGecko target currency identifier (`eur`, `usd`, `gbp`, ...).
 */
export async function fetchEthPriceInFiat(vsCurrency: string): Promise<number> {
  const key = vsCurrency.toLowerCase();
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=${encodeURIComponent(key)}`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`ETH/${key.toUpperCase()} rate unavailable`);
  const body = (await res.json()) as { ethereum?: Record<string, number> };
  const v = body.ethereum?.[key];
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
    throw new Error(`ETH/${key.toUpperCase()} parse error`);
  }
  return v;
}

/** @deprecated Prefer `fetchEthPriceInFiat("eur")` or any selected fiat currency. */
export async function fetchEthEurCoingecko(): Promise<number> {
  return fetchEthPriceInFiat("eur");
}
