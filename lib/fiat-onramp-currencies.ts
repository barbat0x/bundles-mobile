/**
 * Devises fiat proposées pour l’on-ramp (thirdweb `Onramp.prepare` → Transak).
 * Transak impose des paires pays / devise / KYC côté widget ; ici on choisit la **devise de cotation**
 * alignée avec le `currency` du bridge (symbole ISO usuel : EUR, USD, …).
 *
 * @see https://docs.transak.com/docs/fiat-currencies — liste plus large côté Transak ; on garde un sous-ensemble stable pour l’UI.
 */
export const ONRAMP_FIAT_OPTIONS = [
  { code: "EUR" as const, label: "EUR €", coingeckoVs: "eur" },
  { code: "USD" as const, label: "USD $", coingeckoVs: "usd" },
  { code: "GBP" as const, label: "GBP £", coingeckoVs: "gbp" },
  { code: "CHF" as const, label: "CHF", coingeckoVs: "chf" },
] as const;

export type OnRampFiatCurrencyCode = (typeof ONRAMP_FIAT_OPTIONS)[number]["code"];

export function coingeckoVsForFiat(code: OnRampFiatCurrencyCode): string {
  const row = ONRAMP_FIAT_OPTIONS.find((o) => o.code === code);
  return row?.coingeckoVs ?? "eur";
}

/** Devise par défaut selon le locale (US → USD, UK → GBP, sinon EUR). */
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
  if (locale.endsWith("-ch") || locale.startsWith("de-ch") || locale.startsWith("fr-ch")) return "CHF";
  return "EUR";
}
