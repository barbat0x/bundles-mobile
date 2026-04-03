import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useNetInfo } from "@react-native-community/netinfo";
import { useActiveAccount } from "thirdweb/react-native";
import { useQuery } from "@tanstack/react-query";

import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { BundlesButton } from "@/components/ui";
import { WalletMenuHeader } from "@/components/wallet-menu-header";
import { TopVioletGradient } from "@/components/top-violet-gradient";
import {
  PortfolioFigmaBuyIcon,
  PortfolioFigmaSendIcon,
  PortfolioFigmaSwapIcon,
} from "@/assets/utility/portfolio-figma-icons";
import { formatFiatAmount, formatPct } from "@/lib/format";
import { t } from "@/lib/i18n";
import { bundleIconUrl } from "@/lib/media";
import { uiTokens } from "@/lib/ui-tokens";
import { cardShadow, pageVioletBg } from "@/lib/ui-shell";
import {
  sumPortfolioUsd,
  useEnrichedPositions,
  useUserPositions,
} from "@/features/portfolio/portfolio-queries";
import { useCallback, useState, type ReactNode } from "react";
import { useNetworkStore } from "@/store/network-store";
import { useFiatPreferencesStore } from "@/store/fiat-preferences-store";
import { resolveEffectiveFiatCurrency, resolveUserCountryCode } from "@/lib/fiat-country-capabilities";
import { fetchUsdToSelectedFiatRate } from "@/services/prices/usd-fiat";

type PortfolioTimeframe = "H" | "D" | "W" | "Y";
const accentViolet = "#AA03B6";
const accentVioletSoft = "#AA03B61A";
const iconViolet = "#AA03B6";

function ActionItem({
  icon,
  label,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable className="flex-1 flex-row items-center justify-center gap-2 active:opacity-90" onPress={onPress}>
      {icon}
      <Text className="text-[18px] text-[#181818] font-semibold">{label}</Text>
    </Pressable>
  );
}

export function PortfolioScreen() {
  const router = useRouter();
  const account = useActiveAccount();
  const bypassAuthForDev =
    __DEV__ && process.env.EXPO_PUBLIC_DEV_BYPASS_PORTFOLIO_AUTH === "true";
  const effectiveAddress =
    account?.address ??
    (bypassAuthForDev ? ("0x0000000000000000000000000000000000000000" as const) : undefined);
  const net = useNetInfo();
  const activeChainId = useNetworkStore((s) => s.activeChainId);
  const posQ = useUserPositions(effectiveAddress, activeChainId);
  const { rows, isLoading: enrichLoading } = useEnrichedPositions(posQ.data, activeChainId);
  const [refreshing, setRefreshing] = useState(false);
  const preferredFiatCurrency = useFiatPreferencesStore((s) => s.preferredFiatCurrency);
  const fiatResolution = resolveEffectiveFiatCurrency({
    countryCode: resolveUserCountryCode(),
    userPreference: preferredFiatCurrency,
  });
  const fiatCurrency = fiatResolution.effectiveFiatCurrency;
  const usdToFiatRateQuery = useQuery({
    queryKey: ["prices", "usd-to-fiat", fiatCurrency],
    queryFn: () => fetchUsdToSelectedFiatRate(fiatCurrency),
    staleTime: 60_000,
  });

  const total = sumPortfolioUsd(rows);
  const usdToFiatRate = usdToFiatRateQuery.data ?? 1;
  const totalFiat = total * usdToFiatRate;
  const dayW = rows.reduce((s, r) => s + (r.stats?.priceVariations?.lastDay ?? 0), 0) / (rows.length || 1);
  const dayPct = formatPct(dayW);
  const [selectedTimeframe, setSelectedTimeframe] = useState<PortfolioTimeframe>("D");

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await posQ.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [posQ]);

  if (!effectiveAddress) {
    return (
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: pageVioletBg }}>
        <Text className="text-bundle-text mb-4 text-center">{t("portfolio.connectToView")}</Text>
        <ConnectWalletButton />
      </View>
    );
  }

  const offline = net.isConnected === false;

  if (posQ.isLoading || enrichLoading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: pageVioletBg }}>
        <ActivityIndicator color={uiTokens.colors.ctaPrimary} />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: pageVioletBg }}>
      <View className="absolute top-0 left-0 right-0">
        <TopVioletGradient gradientId="portfolioTopVioletFade" />
      </View>
      {offline ? (
        <View className="bg-amber-100 px-4 py-2">
          <Text className="text-amber-900 text-sm">{t("portfolio.offlineSyncWarning")}</Text>
        </View>
      ) : null}
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        contentContainerStyle={{ paddingBottom: 28 }}
      >
        <View className="px-[14px] pt-[52px]">
          <WalletMenuHeader />
          <View className="rounded-[20px] bg-white overflow-hidden" style={cardShadow}>
            <View className="px-5 pt-5">
              <View className="flex-row items-center justify-between">
                <Text className="text-[20px] leading-[24px] font-semibold text-[#181818]">{t("portfolio.portfolio")}</Text>
                <Text className="text-[20px] leading-[24px] font-semibold text-[#181818]">
                  {formatFiatAmount(totalFiat, fiatCurrency)}
                </Text>
              </View>
              <Text className="text-right text-[16px] mt-1" style={{ color: "#A9AAB2" }}>
                {dayPct.text}
              </Text>
            </View>
            <View className="h-[146px] px-3 mt-0">
              <Svg width="100%" height="100%" viewBox="0 0 347 146" preserveAspectRatio="none">
                <Path
                  d="M0 101 C 28 120, 38 125, 52 84 C 66 35, 88 55, 106 50 C 124 45, 138 82, 160 88 C 182 94, 205 74, 222 80 C 239 86, 254 70, 266 98 C 278 126, 296 120, 312 112 C 328 104, 338 110, 347 108"
                  fill="none"
                  stroke={accentViolet}
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </Svg>
            </View>
            <View className="flex-row items-center justify-center gap-14 pb-4 pt-3">
              {(["H", "D", "W", "Y"] as const).map((tf) => (
                <Pressable key={tf} onPress={() => setSelectedTimeframe(tf)} className="px-3 py-1 rounded-[8px] active:opacity-80">
                  <View className={selectedTimeframe === tf ? "rounded-[8px] px-3 py-1" : ""} style={selectedTimeframe === tf ? { backgroundColor: accentVioletSoft } : undefined}>
                    <Text
                      className="text-[16px] font-medium"
                      style={{ color: selectedTimeframe === tf ? accentViolet : "#919299" }}
                    >
                      {tf}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="mt-4 rounded-[20px] bg-white h-16 flex-row items-center overflow-hidden" style={cardShadow}>
            <ActionItem
              icon={<PortfolioFigmaBuyIcon color={iconViolet} width={18} height={18} />}
              label={t("portfolio.buy")}
              onPress={() => router.push("/(tabs)/trade")}
            />
            <View className="h-full w-[1.5px] bg-[#E5E5E5]" />
            <ActionItem
              icon={<PortfolioFigmaSwapIcon color={iconViolet} width={18} height={18} />}
              label={t("portfolio.swap")}
              onPress={() => router.push("/(tabs)/trade")}
            />
            <View className="h-full w-[1.5px] bg-[#E5E5E5]" />
            <ActionItem
              icon={<PortfolioFigmaSendIcon color={iconViolet} width={18} height={18} />}
              label={t("portfolio.send")}
              onPress={() => router.push("/settings")}
            />
          </View>

          <View className="mt-4 rounded-[20px] bg-white overflow-hidden" style={cardShadow}>
            <View className="px-5 py-4 border-b border-[#E5E5E5]">
              <Text className="text-[20px] leading-[24px] font-semibold text-[#181818]">{t("portfolio.myTokens")}</Text>
            </View>

            {rows.length === 0 ? (
              <View className="px-5 py-6">
                <Text className="text-[#919299] text-[16px] mb-3">{t("portfolio.noTokensYet")}</Text>
                <BundlesButton variant="primary" onPress={() => router.replace("/")}>
                  {t("portfolio.discoverBundles")}
                </BundlesButton>
              </View>
            ) : (
              rows.slice(0, 4).map((item) => {
                const day = item.stats?.priceVariations?.lastDay ?? 0;
                const units = Number(item.balance) / 10 ** item.index.decimals;
                return (
                  <Pressable
                    key={item.bundleAddress}
                    onPress={() =>
                      router.push({
                        pathname: "/bundle/[address]",
                        params: { address: item.bundleAddress },
                      })
                    }
                    className="px-5 py-3 flex-row items-center active:opacity-90"
                  >
                    <Image
                      source={{ uri: bundleIconUrl(item.bundleAddress, activeChainId) }}
                      style={{ width: 40, height: 40, borderRadius: 20 }}
                    />
                    <View className="ml-[10px] flex-1">
                      <Text className="text-[16px] leading-[19px] font-medium text-[#181818]">
                        {item.index.name}
                      </Text>
                      <Text className="text-[14px] text-[#A9AAB2]">
                        {units.toFixed(3)} {item.index.symbol}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-[15px] text-[#181818]">
                        {formatFiatAmount(item.valueUsd * usdToFiatRate, fiatCurrency)}
                      </Text>
                      <Text className="text-[13px] text-[#A9AAB2]">{formatPct(day).text}</Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

