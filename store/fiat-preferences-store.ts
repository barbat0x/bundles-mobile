import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { OnRampFiatCurrencyCode } from "@/lib/fiat-onramp-currencies";

type FiatPreferencesState = {
  preferredFiatCurrency: OnRampFiatCurrencyCode | null;
  setPreferredFiatCurrency: (currency: OnRampFiatCurrencyCode) => void;
};

export const useFiatPreferencesStore = create<FiatPreferencesState>()(
  persist(
    (set) => ({
      preferredFiatCurrency: null,
      setPreferredFiatCurrency: (preferredFiatCurrency) => set({ preferredFiatCurrency }),
    }),
    {
      name: "bundles_fiat_preferences_v1",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
