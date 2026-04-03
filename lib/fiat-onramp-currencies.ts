/**
 * Supported fiat currencies for on-ramp flow (thirdweb `Onramp.prepare` -> Transak).
 * Transak applies country/currency/KYC constraints in the widget; here we select the
 * quote currency aligned with bridge `currency` (standard ISO symbols: EUR, USD, ...).
 *
 * @see https://docs.transak.com/docs/fiat-currencies - broader Transak list; we keep a stable UI subset.
 */
export const ONRAMP_FIAT_OPTIONS = [
  { code: "EUR" as const, label: "EUR €", coingeckoVs: "eur" },
  { code: "USD" as const, label: "USD $", coingeckoVs: "usd" },
  { code: "GBP" as const, label: "GBP £", coingeckoVs: "gbp" },
  { code: "CHF" as const, label: "CHF", coingeckoVs: "chf" },
  { code: "DKK" as const, label: "DKK kr", coingeckoVs: "dkk" },
] as const;

export type OnRampFiatCurrencyCode = (typeof ONRAMP_FIAT_OPTIONS)[number]["code"];

export function coingeckoVsForFiat(code: OnRampFiatCurrencyCode): string {
  const row = ONRAMP_FIAT_OPTIONS.find((o) => o.code === code);
  return row?.coingeckoVs ?? "eur";
}

/** Default fiat currency from locale (US -> USD, UK -> GBP, otherwise EUR). */
export function defaultOnRampFiatCurrency(): OnRampFiatCurrencyCode {
  let locale = "";
  try {
    if (typeof navigator !== "undefined" && typeof navigator.language === "string") {
      locale = navigator.language.toLowerCase();
    } else {
      locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
    }
  } catch {
    return "EUR";
  }
  if (locale === "en-us" || locale.endsWith("-us")) return "USD";
  if (locale.endsWith("-gb") || locale === "en-gb") return "GBP";
  if (locale.endsWith("-dk") || locale === "da-dk") return "DKK";
  if (locale.endsWith("-ch") || locale.startsWith("de-ch") || locale.startsWith("fr-ch")) return "CHF";
  return "EUR";
}
