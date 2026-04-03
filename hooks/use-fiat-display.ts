import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { resolveEffectiveFiatCurrency, resolveUserCountryCode } from "@/lib/fiat-country-capabilities";
import { useFiatPreferencesStore } from "@/store/fiat-preferences-store";
import { fetchUsdToSelectedFiatRate } from "@/services/prices/usd-fiat";

export function useSelectedFiatCurrency() {
  const preferredFiatCurrency = useFiatPreferencesStore((s) => s.preferredFiatCurrency);
  const countryCode = resolveUserCountryCode();
  return useMemo(
    () =>
      resolveEffectiveFiatCurrency({
        countryCode,
        userPreference: preferredFiatCurrency,
      }).effectiveFiatCurrency,
    [countryCode, preferredFiatCurrency],
  );
}

export function useUsdToFiatRate() {
  const fiatCurrency = useSelectedFiatCurrency();
  const rateQuery = useQuery({
    queryKey: ["prices", "usd-to-fiat", fiatCurrency],
    queryFn: () => fetchUsdToSelectedFiatRate(fiatCurrency),
    staleTime: 60_000,
  });
  return {
    fiatCurrency,
    usdToFiatRate: rateQuery.data ?? 1,
  };
}
