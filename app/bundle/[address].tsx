import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { PriceChart } from "@/components/price-chart";
import { BundlesButton } from "@/components/ui";
import { TokenIcon } from "@/components/token-icon";
import { WalletMenuHeader } from "@/components/wallet-menu-header";
import { TopVioletGradient } from "@/components/top-violet-gradient";
import {
  useBundleDetail,
  usePriceHistory,
  useTokenStatistics,
} from "@/features/bundles/bundles-queries";
import { formatPct, formatUsd, formatWeightPercent } from "@/lib/format";
import { t } from "@/lib/i18n";
import { bundleIconUrl } from "@/lib/media";
import { uiTokens } from "@/lib/ui-tokens";
import { cardShadow, pageVioletBg } from "@/lib/ui-shell";
import { useNetworkStore } from "@/store/network-store";
import type { HistoryTimeframe } from "@/services/bundles-ws/token-api";

function normalizeWeightWei(value: bigint | number): bigint {
  if (typeof value === "bigint") return value;
  if (!Number.isFinite(value)) return 0n;
  return BigInt(Math.max(0, Math.trunc(value)));
}

export default function BundleDetailRoute() {
  const { address } = useLocalSearchParams<{ address: string }>();
  const router = useRouter();
  const activeChainId = useNetworkStore((s) => s.activeChainId);
  const detailQ = useBundleDetail(typeof address === "string" ? address : undefined, activeChainId);
  const statsQ = useTokenStatistics(typeof address === "string" ? address : undefined, activeChainId);
  const [timeframe, setTimeframe] = useState<HistoryTimeframe>("week");
  const histQ = usePriceHistory(
    typeof address === "string" ? address : undefined,
    timeframe,
    activeChainId,
  );

  const bundle = detailQ.data;
  const price = statsQ.data?.priceUSD;
  const { text: varText, positive } = formatPct(statsQ.data?.priceVariations?.lastDay);

  if (detailQ.isLoading || !address) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: pageVioletBg }}>
        <ActivityIndicator color={uiTokens.colors.ctaPrimary} />
      </View>
    );
  }

  if (detailQ.isError || !bundle) {
    return (
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: pageVioletBg }}>
        <Text className="text-bundle-text text-center">{t("bundleDetail.notFound")}</Text>
      </View>
    );
  }

  const totalSupplyUnits = Number(bundle.totalSupply) / 10 ** bundle.decimals;
  const mcap = price !== undefined ? price * totalSupplyUnits : undefined;
  const totalWeightWei = bundle.assets.reduce((sum, a) => sum + normalizeWeightWei(a.startWeight), 0n);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1" style={{ backgroundColor: pageVioletBg }}>
        <View className="absolute top-0 left-0 right-0">
          <TopVioletGradient gradientId="bundleTopVioletFade" />
        </View>
        <ScrollView className="flex-1" contentContainerClassName="px-[14px] pt-[52px] pb-16">
          <WalletMenuHeader />

          <View className="rounded-[20px] bg-white p-4 mb-4" style={cardShadow}>
            <View className="flex-row items-center justify-between mb-4">
              <Pressable
                onPress={() => router.back()}
                className="h-10 w-10 rounded-full bg-[#F7F8FA] border border-[#E5E5E5] items-center justify-center"
              >
                <Feather name="chevron-left" size={20} color="#181818" />
              </Pressable>
              <View className="flex-row items-center gap-3 ml-3">
                <Image
                  source={{ uri: bundleIconUrl(bundle.address, activeChainId) }}
                  style={{ width: 56, height: 56, borderRadius: 12 }}
                />
                <View className="items-end">
                  <Text className="text-xl font-semibold text-bundle-text text-right self-end">
                    {bundle.name}
                  </Text>
                  <Text className="text-bundle-muted text-right self-end">{bundle.symbol}</Text>
                </View>
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
              timeframe={timeframe}
              onChangeTimeframe={setTimeframe}
            />
          </View>

          <View className="rounded-[20px] bg-white p-4 mb-4" style={cardShadow}>
            <Text className="text-[20px] leading-[24px] font-semibold text-[#181818] mb-3">{t("bundleDetail.metrics")}</Text>
            <Text className="text-bundle-muted text-sm font-mono mb-1">
              {t("bundleDetail.marketCap")}: {mcap !== undefined ? formatUsd(mcap) : "—"}
            </Text>
            <Text className="text-bundle-muted text-sm mb-1">{t("bundleDetail.mintBurnFee")}: {bundle.mintBurnFee}</Text>
            <Text className="text-bundle-muted text-sm mb-1">{t("bundleDetail.swapFee")}: {bundle.swapFee}</Text>
            <Text className="text-bundle-muted text-sm font-mono">{t("bundleDetail.holders")}: {bundle.holderCount}</Text>
          </View>

          <View className="rounded-[20px] bg-white p-4 mb-4" style={cardShadow}>
            <Text className="text-[20px] leading-[24px] font-semibold text-[#181818] mb-3">{t("bundleDetail.underlyings")}</Text>
            {bundle.assets.map((a) => (
              <View
                key={a.tokenAddress}
                className="py-2 border-b border-bundle-border-subtle flex-row items-center justify-between"
              >
                <View className="flex-row items-center gap-2">
                  <TokenIcon chainId={activeChainId} tokenAddress={a.tokenAddress} size={24} />
                  <Text className="text-bundle-text">
                    {a.symbol} <Text className="text-bundle-muted text-sm">{a.name}</Text>
                  </Text>
                </View>
                <Text className="text-bundle-muted">
                  {formatWeightPercent(normalizeWeightWei(a.startWeight), totalWeightWei)}
                </Text>
              </View>
            ))}
          </View>

          <View className="mt-6">
            <BundlesButton
              variant="primary"
              className="h-16 rounded-[20px] border-0"
              style={{ backgroundColor: "#8A0294", opacity: 1 }}
              onPress={() =>
                router.push({ pathname: "/(tabs)/trade", params: { bundle: bundle.address } })
              }
            >
              {t("bundleDetail.trade")}
            </BundlesButton>
          </View>
        </ScrollView>
      </View>
    </>
  );
}

