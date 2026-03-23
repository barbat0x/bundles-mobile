import { create } from "zustand";

import { clampSlippageBps, DEFAULT_SLIPPAGE_BPS } from "@/lib/slippage";

type TradeMode = "cb" | "swap";

type State = {
  tradeTabMode: TradeMode;
  slippageBps: number;
  setTradeTabMode: (m: TradeMode) => void;
  setSlippageBps: (bps: number) => void;
};

export const useTradeUiStore = create<State>((set) => ({
  tradeTabMode: "cb",
  slippageBps: DEFAULT_SLIPPAGE_BPS,
  setTradeTabMode: (tradeTabMode) => set({ tradeTabMode }),
  setSlippageBps: (slippageBps) => set({ slippageBps: clampSlippageBps(slippageBps) }),
}));
