import {
  isFiatCurrencySupportedForCountry,
  resolveEffectiveFiatCurrency,
  resolveSupportedFiatCurrencies,
} from "@/lib/fiat-country-capabilities";

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: {} } },
}));

describe("fiat country capabilities", () => {
  it("FR supports EUR and rejects GBP", () => {
    expect(resolveSupportedFiatCurrencies("FR")).toEqual(["EUR"]);
    expect(isFiatCurrencySupportedForCountry("FR", "GBP")).toBe(false);
  });

  it("GB supports GBP and keeps valid preference", () => {
    const resolved = resolveEffectiveFiatCurrency({
      countryCode: "GB",
      userPreference: "GBP",
    });
    expect(resolved.effectiveFiatCurrency).toBe("GBP");
    expect(resolved.didFallback).toBe(false);
  });

  it("CH supports CHF and fallback from invalid preference", () => {
    const resolved = resolveEffectiveFiatCurrency({
      countryCode: "CH",
      userPreference: "GBP",
    });
    expect(resolved.capabilities.supportedFiatCurrencies).toEqual(["CHF", "EUR"]);
    expect(resolved.effectiveFiatCurrency).toBe("CHF");
    expect(resolved.didFallback).toBe(true);
  });
});
