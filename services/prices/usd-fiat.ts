import { coingeckoVsForFiat, type OnRampFiatCurrencyCode } from "@/lib/fiat-onramp-currencies";
import { fetchEthPriceInFiat } from "@/services/prices/eth-fiat";
import { fetchEthUsdCoingeckoCached } from "@/services/prices/eth-usd";

/**
 * Converts USD amount to selected fiat through ETH cross-rate to avoid extra providers.
 * formula: USD -> ETH (via ETH/USD), then ETH -> fiat.
 */
export async function convertUsdToSelectedFiat(
  usdAmount: number,
  fiatCurrency: OnRampFiatCurrencyCode,
): Promise<number> {
  if (!Number.isFinite(usdAmount) || usdAmount < 0) return 0;
  if (fiatCurrency === "USD") return usdAmount;

  const [ethUsd, ethFiat] = await Promise.all([
    fetchEthUsdCoingeckoCached(),
    fetchEthPriceInFiat(coingeckoVsForFiat(fiatCurrency)),
  ]);
  if (ethUsd <= 0 || ethFiat <= 0) return usdAmount;

  const ethAmount = usdAmount / ethUsd;
  return ethAmount * ethFiat;
}

export async function fetchUsdToSelectedFiatRate(
  fiatCurrency: OnRampFiatCurrencyCode,
): Promise<number> {
  if (fiatCurrency === "USD") return 1;
  const [ethUsd, ethFiat] = await Promise.all([
    fetchEthUsdCoingeckoCached(),
    fetchEthPriceInFiat(coingeckoVsForFiat(fiatCurrency)),
  ]);
  if (ethUsd <= 0 || ethFiat <= 0) return 1;
  return ethFiat / ethUsd;
}
