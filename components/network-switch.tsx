import { View } from "react-native";

import { BundlesSegmented } from "@/components/ui";
import { SUPPORTED_CHAINS, type SupportedChainId } from "@/lib/chains";
import { useNetworkStore } from "@/store/network-store";

/** Chain pills — same segmented pattern as explore filters (`radio-group` / muted). */
export function NetworkSwitch() {
  const { activeChainId, setActiveChainId } = useNetworkStore();

  return (
    <View className="flex-row gap-2">
      <BundlesSegmented
        variant="muted"
        value={String(activeChainId)}
        onChange={(v) => setActiveChainId(Number(v) as SupportedChainId)}
        options={SUPPORTED_CHAINS.map((chain) => ({
          value: String(chain.id),
          label: chain.shortName,
        }))}
      />
    </View>
  );
}
