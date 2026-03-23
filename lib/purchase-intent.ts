import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Address } from "viem";
import type { SupportedChainId } from "@/lib/chains";

const STORAGE_KEY = "bundles_purchase_intent_v1";

/** PLAN §5.8 Mode A — persisted purchase metadata (no secrets). */
export type PurchaseIntent = {
  id: string;
  chainId: SupportedChainId;
  bundleAddress: Address;
  desiredBundleAmount: string;
  /** Snapshot au moment du quote fiat (affichage / debug). Le swap utilise un re-quote frais (voir trade-screen). */
  expectedEthCost: string;
  onRampIntentId: string;
  status: "payment_pending" | "funds_pending" | "swapping" | "payment_failed" | "swap_failed";
  createdAt: number;
};

export async function savePurchaseIntent(intent: PurchaseIntent): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(intent));
}

export async function loadPurchaseIntent(): Promise<PurchaseIntent | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PurchaseIntent;
  } catch {
    return null;
  }
}

export async function clearPurchaseIntent(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
