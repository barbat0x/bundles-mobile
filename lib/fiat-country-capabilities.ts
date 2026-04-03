import Constants from "expo-constants";

import { ONRAMP_FIAT_OPTIONS, type OnRampFiatCurrencyCode } from "@/lib/fiat-onramp-currencies";

export type CountryCode = string;

export type CountryFiatCapabilities = {
  countryCode: CountryCode;
  supportedFiatCurrencies: OnRampFiatCurrencyCode[];
  defaultFiatCurrency: OnRampFiatCurrencyCode;
  source: "static-map";
  resolvedAtMs: number;
};

const allSupportedFiatCodes: OnRampFiatCurrencyCode[] = ONRAMP_FIAT_OPTIONS.map((o) => o.code);

const countryFiatMap: Partial<Record<CountryCode, OnRampFiatCurrencyCode[]>> = {
  // Source: Transak fiat-country coverage table (docs.transak.com/docs/fiat-currency-countries)
  // We intentionally keep only fiat currencies currently supported by this app.
  AD: ["EUR"],
  AX: ["EUR"],
  AT: ["EUR"],
  BE: ["EUR"],
  CY: ["EUR"],
  DK: ["DKK", "EUR"],
  EE: ["EUR"],
  FI: ["EUR"],
  FR: ["EUR"],
  GF: ["EUR"],
  DE: ["EUR"],
  GP: ["EUR"],
  GR: ["EUR"],
  HU: ["EUR"],
  IE: ["EUR"],
  IT: ["EUR"],
  LV: ["EUR"],
  LT: ["EUR"],
  LU: ["EUR"],
  MT: ["EUR"],
  MQ: ["EUR"],
  YT: ["EUR"],
  ME: ["EUR"],
  ES: ["EUR"],
  NL: ["EUR"],
  NO: ["EUR"],
  PL: ["EUR"],
  PT: ["EUR"],
  RE: ["EUR"],
  MF: ["EUR"],
  SK: ["EUR"],
  SI: ["EUR"],
  SE: ["EUR"],
  CH: ["CHF", "EUR"],

  // United Kingdom and United States have direct fiat support in their native currencies.
  GB: ["GBP"],
  US: ["USD"],

  // Legacy aliases kept for compatibility where locale resolution may vary.
  UK: ["GBP"],

};

function countryFromLocale(locale: string): CountryCode | undefined {
  const normalized = locale.replace(/_/g, "-").trim();
  const parts = normalized.split("-").filter(Boolean);
  if (parts.length < 2) return undefined;
  for (let i = 1; i < parts.length; i += 1) {
    const token = parts[i];
    if (/^[a-zA-Z]{2}$/.test(token)) return token.toUpperCase();
  }
  return undefined;
}

export function resolveUserCountryCode(): CountryCode | undefined {
  const fromEnv =
    process.env.EXPO_PUBLIC_ONRAMP_COUNTRY?.trim() ||
    (
      Constants.expoConfig?.extra as { EXPO_PUBLIC_ONRAMP_COUNTRY?: string } | undefined
    )?.EXPO_PUBLIC_ONRAMP_COUNTRY?.trim();
  if (fromEnv && /^[a-zA-Z]{2}$/.test(fromEnv)) return fromEnv.toUpperCase();

  if (typeof navigator !== "undefined" && typeof navigator.language === "string") {
    const country = countryFromLocale(navigator.language);
    if (country) return country;
  }

  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? "";
    const country = countryFromLocale(locale);
    if (country) return country;
  } catch {
    return undefined;
  }

  return undefined;
}

export function resolveSupportedFiatCurrencies(countryCode: CountryCode | undefined): OnRampFiatCurrencyCode[] {
  if (!countryCode) return ["EUR"];
  return countryFiatMap[countryCode] ?? ["EUR"];
}

export function resolveEffectiveFiatCurrency(args: {
  countryCode: CountryCode | undefined;
  userPreference: OnRampFiatCurrencyCode | null | undefined;
}): {
  effectiveFiatCurrency: OnRampFiatCurrencyCode;
  capabilities: CountryFiatCapabilities;
  didFallback: boolean;
} {
  const supportedRaw = resolveSupportedFiatCurrencies(args.countryCode);
  const supported = supportedRaw.filter((code): code is OnRampFiatCurrencyCode =>
    allSupportedFiatCodes.includes(code),
  );
  const safeSupported: OnRampFiatCurrencyCode[] =
    supported.length > 0 ? supported : (["EUR"] as OnRampFiatCurrencyCode[]);
  const defaultFiatCurrency = safeSupported[0];

  const isValidPreference = Boolean(
    args.userPreference && safeSupported.includes(args.userPreference),
  );
  const effectiveFiatCurrency = isValidPreference
    ? (args.userPreference as OnRampFiatCurrencyCode)
    : defaultFiatCurrency;

  return {
    effectiveFiatCurrency,
    didFallback: !isValidPreference && Boolean(args.userPreference),
    capabilities: {
      countryCode: args.countryCode ?? "UNSPECIFIED",
      supportedFiatCurrencies: safeSupported,
      defaultFiatCurrency,
      source: "static-map",
      resolvedAtMs: Date.now(),
    },
  };
}

export function isFiatCurrencySupportedForCountry(
  countryCode: CountryCode | undefined,
  fiatCurrency: OnRampFiatCurrencyCode,
): boolean {
  return resolveSupportedFiatCurrencies(countryCode).includes(fiatCurrency);
}
