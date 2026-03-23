import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { DEFAULT_CHAIN_ID, type SupportedChainId } from "@/lib/chains";

type NetworkState = {
  activeChainId: SupportedChainId;
  setActiveChainId: (chainId: SupportedChainId) => void;
};

export const useNetworkStore = create<NetworkState>()(
  persist(
    (set) => ({
      activeChainId: DEFAULT_CHAIN_ID,
      setActiveChainId: (activeChainId) => set({ activeChainId }),
    }),
    {
      name: "bundles_network_store_v1",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
