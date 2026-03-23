import Constants from "expo-constants";
import type { ThirdwebClient } from "thirdweb";
import { NATIVE_TOKEN_ADDRESS } from "thirdweb";
import { Onramp } from "thirdweb/bridge";
import { getBuyWithFiatStatus } from "thirdweb/pay";
import { toUnits } from "thirdweb/utils";
import { getAddress, type Address } from "viem";

import {
  coingeckoVsForFiat,
  type OnRampFiatCurrencyCode,
} from "@/lib/fiat-onramp-currencies";
import type { SupportedChainId } from "@/lib/chains";
import { isOnRampEnabledChain } from "@/lib/chains";
import { assertTrustedTransakOnRampUrl } from "@/lib/onramp-url";
import { fetchEthPriceInFiat } from "@/services/prices/eth-fiat";

/** Fields consumed by the app to avoid depending on `BuyWithFiatQuote`. */
export type FiatOnrampQuote = {
  intentId: string;
  onRampLink: string;
  onRampToken: { amountWei: string };
};

/**
 * Resolve Transak/thirdweb country code (ISO 3166-1 alpha-2).
 *
 * Without `country`, thirdweb may default to "US", which can reject
 * non-USD fiat currencies for users outside the US.
 *
 * Priority:
 * 1) `EXPO_PUBLIC_ONRAMP_COUNTRY` if defined (example: `FR`)
 * 2) locale region from browser/Intl (`fr-FR` -> `FR`)
 */
function resolveOnRampCountryCode(): string | undefined {
  const fromEnv =
    process.env.EXPO_PUBLIC_ONRAMP_COUNTRY?.trim() ||
    (
      Constants.expoConfig?.extra as { EXPO_PUBLIC_ONRAMP_COUNTRY?: string } | undefined
    )?.EXPO_PUBLIC_ONRAMP_COUNTRY?.trim();
  if (fromEnv && /^[a-zA-Z]{2}$/.test(fromEnv)) {
    return fromEnv.toUpperCase();
  }

  if (typeof navigator !== "undefined" && typeof navigator.language === "string") {
    const m = navigator.language.match(/-([a-zA-Z]{2})$/);
    if (m?.[1]) return m[1].toUpperCase();
  }
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? "";
    const m = locale.match(/-([a-zA-Z]{2})$/);
    if (m?.[1]) return m[1].toUpperCase();
  } catch {
    /* ignore */
  }
  return undefined;
}

function parsePositiveFiatAmount(raw: string | number): number {
  const s = typeof raw === "number" ? String(raw) : String(raw).trim();
  const n = Number.parseFloat(s.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("Montant invalide");
  }
  return n;
}

/** ETH amount in human units used to derive wei for `Onramp.prepare`. */
function ethHumanToToAmountString(eth: number): string {
  if (!Number.isFinite(eth) || eth <= 0) {
    throw new Error("Montant ETH estimé invalide");
  }
  const s = eth.toFixed(18);
  return s.replace(/\.?0+$/, "") || "0";
}

async function transakPrepareFiatQuote(args: {
  client: ThirdwebClient;
  chainId: number;
  walletAddress: `0x${string}`;
  toAmountEthHuman: string;
  /** Must match what Transak accepts for the current country/session. */
  fromCurrencySymbol: OnRampFiatCurrencyCode;
}): Promise<FiatOnrampQuote> {
  const amountWei = toUnits(args.toAmountEthHuman, 18);
  const country = resolveOnRampCountryCode();

  const prepared = await Onramp.prepare({
    client: args.client,
    onramp: "transak",
    chainId: args.chainId,
    tokenAddress: NATIVE_TOKEN_ADDRESS,
    receiver: args.walletAddress,
    sender: args.walletAddress,
    amount: amountWei,
    currency: args.fromCurrencySymbol,
    maxSteps: 2,
    ...(country ? { country } : {}),
  });

  const firstStep = prepared.steps[0];
  const onRampTokenAmountWei =
    prepared.steps.length > 0 && firstStep ? firstStep.originAmount : prepared.destinationAmount;

  return {
    intentId: prepared.id,
    onRampLink: prepared.link,
    onRampToken: { amountWei: onRampTokenAmountWei.toString() },
  };
}

export async function quoteFiatToEthOnramp(args: {
  client: ThirdwebClient;
  chainId: SupportedChainId;
  walletAddress: string;
  /** Amount in the selected fiat currency (example: "100"). */
  fiatAmount: string | number;
  /** Payment fiat currency passed to `Onramp.prepare` / Transak. */
  fiatCurrency: OnRampFiatCurrencyCode;
}): Promise<FiatOnrampQuote> {
  if (!isOnRampEnabledChain(args.chainId)) {
    throw new Error("On-ramp indisponible sur ce réseau");
  }
  const walletAddress = getAddress(args.walletAddress as Address);
  const fiat = parsePositiveFiatAmount(args.fiatAmount);
  const vs = coingeckoVsForFiat(args.fiatCurrency);
  const ethInFiat = await fetchEthPriceInFiat(vs);
  const toAmountEthHuman = ethHumanToToAmountString(fiat / ethInFiat);

  const quote = await transakPrepareFiatQuote({
    client: args.client,
    chainId: args.chainId,
    walletAddress,
    toAmountEthHuman,
    fromCurrencySymbol: args.fiatCurrency,
  });
  assertTrustedTransakOnRampUrl(quote.onRampLink);
  return quote;
}

export async function fetchBuyWithFiatIntentStatus(args: {
  client: ThirdwebClient;
  intentId: string;
}) {
  return getBuyWithFiatStatus({
    client: args.client,
    intentId: args.intentId,
  });
}
