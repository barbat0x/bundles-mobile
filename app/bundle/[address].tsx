import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { PriceChart } from "@/components/price-chart";
import { BundlesButton, BundlesCard } from "@/components/ui";
import {
  useBundleDetail,
  usePriceHistory,
  useTokenStatistics,
} from "@/features/bundles/bundles-queries";
import { formatPct, formatUsd } from "@/lib/format";
import { bundleIconUrl } from "@/lib/media";
import { uiTokens } from "@/lib/ui-tokens";
import { useNetworkStore } from "@/store/network-store";
import type { HistoryTimeframe } from "@/services/bundles-ws/token-api";

export default function BundleDetailRoute() {
  const { address } = useLocalSearchParams<{ address: string }>();
  const router = useRouter();
  const activeChainId = useNetworkStore((s) => s.activeChainId);
  const detailQ = useBundleDetail(typeof address === "string" ? address : undefined, activeChainId);
  const statsQ = useTokenStatistics(typeof address === "string" ? address : undefined, activeChainId);
  const [tf, setTf] = useState<HistoryTimeframe>("week");
  const histQ = usePriceHistory(typeof address === "string" ? address : undefined, tf, activeChainId);

  const b = detailQ.data;
  const price = statsQ.data?.priceUSD;
  const { text: varText, positive } = formatPct(statsQ.data?.priceVariations?.lastDay);

  if (detailQ.isLoading || !address) {
    return (
      <View className="flex-1 bg-bundle-bg items-center justify-center">
        <ActivityIndicator color={uiTokens.colors.ctaPrimary} />
      </View>
    );
  }

  if (detailQ.isError || !b) {
    return (
      <View className="flex-1 bg-bundle-bg items-center justify-center px-6">
        <Text className="text-bundle-text text-center">Bundle introuvable.</Text>
      </View>
    );
  }

  const totalSupplyUnits = Number(b.totalSupply) / 10 ** b.decimals;
  const mcap = price !== undefined ? price * totalSupplyUnits : undefined;

  return (
    <>
      <Stack.Screen options={{ title: b.symbol, headerBackTitle: "Retour" }} />
      <ScrollView className="flex-1 bg-bundle-bg" contentContainerClassName="p-4 pb-16">
        <View className="flex-row items-center gap-3 mb-4">
          <Image
            source={{ uri: bundleIconUrl(b.address, activeChainId) }}
            style={{ width: 56, height: 56, borderRadius: 12 }}
          />
          <View className="flex-1">
            <Text className="text-xl font-semibold text-bundle-text">{b.name}</Text>
            <Text className="text-bundle-muted">{b.symbol}</Text>
          </View>
        </View>

        <View className="mb-2">
          <Text className="text-2xl font-semibold text-bundle-text">
            {price !== undefined ? formatUsd(price) : "—"}
          </Text>
          <Text style={{ color: positive ? uiTokens.colors.success : uiTokens.colors.danger }}>
            {varText} 24h
          </Text>
        </View>

        <PriceChart
          data={histQ.data ?? []}
          loading={histQ.isLoading}
          timeframe={tf}
          onChangeTimeframe={setTf}
        />

        <BundlesCard className="mt-4 p-3">
          <Text className="text-bundle-text font-medium mb-2">Métriques</Text>
          <Text className="text-bundle-muted text-sm font-mono">
            Market cap: {mcap !== undefined ? formatUsd(mcap) : "—"}
          </Text>
          <Text className="text-bundle-muted text-sm">Mint/burn fee: {b.mintBurnFee}</Text>
          <Text className="text-bundle-muted text-sm">Swap fee: {b.swapFee}</Text>
          <Text className="text-bundle-muted text-sm font-mono">Holders: {b.holderCount}</Text>
        </BundlesCard>

        <View className="mt-4">
          <Text className="text-bundle-text font-medium mb-2">Underlyings</Text>
          {b.assets.map((a) => (
            <View key={a.tokenAddress} className="py-2 border-b border-bundle-border-subtle flex-row justify-between">
              <Text className="text-bundle-text">
                {a.symbol} <Text className="text-bundle-muted text-sm">{a.name}</Text>
              </Text>
              <Text className="text-bundle-muted">{a.startWeight}%</Text>
            </View>
          ))}
        </View>

        <View className="mt-6">
          <BundlesButton
            variant="primary"
            onPress={() =>
              router.push({ pathname: "/(tabs)/trade", params: { bundle: b.address } })
            }
          >
            Trade
          </BundlesButton>
        </View>
      </ScrollView>
    </>
  );
}
