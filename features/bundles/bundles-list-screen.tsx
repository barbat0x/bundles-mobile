import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useCallback, useMemo, useState } from "react";
import { useNetInfo } from "@react-native-community/netinfo";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";

import {
  type EnrichedBundle,
  useBundleIndexesList,
  useEnrichedBundleList,
} from "@/features/bundles/bundles-queries";
import { uiTokens } from "@/lib/ui-tokens";
import { useNetworkStore } from "@/store/network-store";
import { bundleIconUrl } from "@/lib/media";
import { formatPct, formatUsd } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { SupportedChainId } from "@/lib/chains";
import { WalletMenuHeader } from "@/components/wallet-menu-header";
import { TopVioletGradient } from "@/components/top-violet-gradient";
import { cardShadow, pageVioletBg } from "@/lib/ui-shell";

type SortKey = "featured" | "market-cap" | "price-change";
const marketCapScale = 1_000_000n;

export function BundlesListScreen() {
  const router = useRouter();
  const net = useNetInfo();
  const activeChainId = useNetworkStore((s) => s.activeChainId);
  const bundlesQuery = useBundleIndexesList(activeChainId);
  const enrichedBundlesQuery = useEnrichedBundleList(bundlesQuery.data, activeChainId);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<SortKey>("featured");

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await bundlesQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [bundlesQuery]);

  const sortedBundles = useMemo(() => {
    const list = [...enrichedBundlesQuery.data];
    if (sort === "featured") return list;
    if (sort === "market-cap") {
      const score = (b: EnrichedBundle): bigint => {
        const priceScaled = BigInt(Math.max(0, Math.round((b.stats?.priceUSD ?? 0) * 1_000_000)));
        const units = 10n ** BigInt(Math.max(0, b.decimals));
        if (units === 0n) return 0n;
        return (b.totalSupply * priceScaled * marketCapScale) / units;
      };
      return list.sort((a, b) => {
        const aMcap = score(a);
        const bMcap = score(b);
        if (aMcap === bMcap) return 0;
        return bMcap > aMcap ? 1 : -1;
      });
    }
    return list.sort(
      (a, b) =>
        (b.stats?.priceVariations?.lastDay ?? Number.NEGATIVE_INFINITY) -
        (a.stats?.priceVariations?.lastDay ?? Number.NEGATIVE_INFINITY),
    );
  }, [enrichedBundlesQuery.data, sort]);

  if (bundlesQuery.isLoading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: pageVioletBg }}>
        <ActivityIndicator color={uiTokens.colors.ctaPrimary} />
        <Text className="text-bundle-muted mt-2">{t("bundlesList.loadingBundles")}</Text>
      </View>
    );
  }

  if (enrichedBundlesQuery.isLoading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: pageVioletBg }}>
        <ActivityIndicator color={uiTokens.colors.ctaPrimary} />
        <Text className="text-bundle-muted mt-2">{t("bundlesList.loadingBundles")}</Text>
      </View>
    );
  }

  if (bundlesQuery.isError) {
    return (
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: pageVioletBg }}>
        <Text className="text-bundle-text text-center mb-3">{t("bundlesList.unableToLoadBundles")}</Text>
        <Text onPress={() => void bundlesQuery.refetch()} className="text-bundle-link font-medium">
          {t("common.retry")}
        </Text>
      </View>
    );
  }

  const offline = net.isConnected === false;

  return (
    <View className="flex-1" style={{ backgroundColor: pageVioletBg }}>
      <View className="absolute top-0 left-0 right-0">
        <TopVioletGradient gradientId="bundlesTopVioletFade" />
      </View>
      {offline ? (
        <View className="bg-amber-100 px-4 py-2">
          <Text className="text-amber-900 text-sm">{t("bundlesList.noInternetConnection")}</Text>
        </View>
      ) : null}
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        contentContainerStyle={{ paddingBottom: 28 }}
      >
        <View className="px-[14px] pt-[52px]">
          <WalletMenuHeader />

          <View className="rounded-[20px] bg-white overflow-hidden" style={cardShadow}>
            <View className="px-5 py-4 border-b border-[#E5E5E5] flex-row items-center justify-between">
              <Text className="text-[20px] leading-[24px] font-semibold text-[#181818]">{t("bundlesList.bundlesList")}</Text>
              <View className="bg-[#F7F8FA] border border-[#E5E5E5] rounded-full h-9 px-3 flex-row items-center gap-1">
                <Text className="text-[16px] text-[#181818]">{t("bundlesList.last24h")}</Text>
                <Feather name="chevron-down" size={16} color="#181818" />
              </View>
            </View>

            <View className="px-5 pt-5 pb-4">
              <View className="h-10 rounded-[14px] bg-[#F4F5F7] flex-row items-center p-1">
                <SortTab label={t("bundlesList.featured")} active={sort === "featured"} onPress={() => setSort("featured")} />
                <SortTab
                  label={t("bundlesList.marketCap")}
                  active={sort === "market-cap"}
                  onPress={() => setSort("market-cap")}
                />
                <SortTab
                  label={t("bundlesList.priceChange")}
                  active={sort === "price-change"}
                  onPress={() => setSort("price-change")}
                />
              </View>
            </View>

            {sortedBundles.length === 0 ? (
              <View className="px-5 pb-6">
                <Text className="text-[#919299] text-[16px]">{t("bundlesList.noBundlesAvailable")}</Text>
              </View>
            ) : (
              sortedBundles.map((item, index) => (
                <BundleRow
                  key={item.address}
                  bundle={item}
                  rank={index + 1}
                  chainId={activeChainId}
                  onPress={() => router.push(`/bundle/${item.address}`)}
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function SortTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`h-8 flex-1 rounded-[12px] items-center justify-center ${active ? "bg-white" : ""}`}
    >
      <Text className="text-[14px] text-[#181818]">{label}</Text>
    </Pressable>
  );
}

function BundleRow({
  bundle,
  rank,
  chainId,
  onPress,
}: {
  bundle: EnrichedBundle;
  rank: number;
  chainId: SupportedChainId;
  onPress: () => void;
}) {
  const variation = bundle.stats?.priceVariations?.lastDay;
  return (
    <Pressable onPress={onPress} className="px-5 py-3 flex-row items-center active:opacity-90">
      <Text className="w-5 text-[14px] text-[#A9AAB2]">{rank}</Text>
      <Image
        source={{ uri: bundleIconUrl(bundle.address, chainId) }}
        style={{ width: 40, height: 40, borderRadius: 20 }}
      />
      <View className="ml-[10px] flex-1">
        <Text className="text-[16px] leading-[19px] font-medium text-[#181818]">{bundle.name}</Text>
        <Text className="text-[14px] text-[#A9AAB2]">{bundle.symbol}</Text>
      </View>
      <View className="items-end">
        <Text className="text-[15px] text-[#181818]">{formatUsd(bundle.stats?.priceUSD ?? 0)}</Text>
        <Text className="text-[13px] text-[#A9AAB2]">{formatPct(variation).text}</Text>
      </View>
    </Pressable>
  );
}

