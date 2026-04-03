import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";

import { BundlesButton } from "@/components/ui";
import { Sparkline } from "@/components/sparkline";
import { formatFiatAmount, formatPct } from "@/lib/format";
import { bundleIconUrl } from "@/lib/media";
import { uiTokens } from "@/lib/ui-tokens";
import { t } from "@/lib/i18n";
import { useWeekSparkline } from "@/features/bundles/bundles-queries";
import type { EnrichedBundle } from "@/features/bundles/bundles-queries";
import type { SupportedChainId } from "@/lib/chains";
import { useUsdToFiatRate } from "@/hooks/use-fiat-display";

interface BundleCardProps {
  bundle: EnrichedBundle;
  chainId: SupportedChainId;
  onPress: () => void;
  onView: () => void;
}

export function BundleCard({ bundle, chainId, onPress, onView }: BundleCardProps) {
  const { data: spark } = useWeekSparkline(bundle.address, chainId);
  const { fiatCurrency, usdToFiatRate } = useUsdToFiatRate();
  const price = bundle.stats?.priceUSD;
  const { text: varText, positive: varPos } = formatPct(bundle.stats?.priceVariations?.lastDay);

  const totalSupplyUnits = Number(bundle.totalSupply) / 10 ** bundle.decimals;
  const mcap = price !== undefined ? price * totalSupplyUnits : undefined;
  const priceFiat = price !== undefined ? price * usdToFiatRate : undefined;
  const mcapFiat = mcap !== undefined ? mcap * usdToFiatRate : undefined;

  const assets = bundle.assets.slice(0, 5);
  const more = bundle.assets.length - assets.length;

  return (
    <View className="bg-bundle-card border border-bundle-border-subtle rounded-md p-4 mb-3">
      <Pressable onPress={onPress} className="active:opacity-95">
        <View className="flex-row items-center gap-3">
          <Image
            source={{ uri: bundleIconUrl(bundle.address, chainId) }}
            style={{ width: 40, height: 40, borderRadius: 8 }}
            contentFit="cover"
          />
          <View className="flex-1">
            <Text
              className="text-bundle-text"
              style={{ fontFamily: uiTokens.fontFamily.sansMedium }}
            >
              {bundle.name}
            </Text>
            <Text className="text-bundle-muted text-sm">{bundle.symbol}</Text>
          </View>
          <Sparkline values={spark ?? []} />
        </View>

        <View className="flex-row flex-wrap gap-1 mt-2">
          {assets.map((a) => (
            <View key={a.tokenAddress} className="bg-bundle-bg px-2 py-0.5 rounded-full">
              <Text className="text-[10px] text-bundle-muted">{a.symbol}</Text>
            </View>
          ))}
          {more > 0 ? (
            <View className="bg-bundle-bg px-2 py-0.5 rounded-full">
              <Text className="text-[10px] text-bundle-muted">+{more}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      <View className="flex-row items-center justify-between mt-3">
        <Pressable onPress={onPress} className="flex-1 flex-row items-center justify-between pr-2 active:opacity-95">
          <View>
            <Text
              className="text-bundle-text"
              style={{ fontFamily: uiTokens.fontFamily.sansSemibold }}
            >
              {priceFiat !== undefined ? formatFiatAmount(priceFiat, fiatCurrency) : "—"}
            </Text>
            <Text style={{ color: varPos ? uiTokens.colors.success : uiTokens.colors.danger }} className="text-sm font-mono">
              {varText} <Text className="text-bundle-muted">24h</Text>
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-bundle-muted text-xs">MCap</Text>
            <Text className="text-bundle-text font-mono">{mcapFiat !== undefined ? formatFiatAmount(mcapFiat, fiatCurrency) : "—"}</Text>
          </View>
        </Pressable>
        <BundlesButton variant="secondary" size="sm" onPress={onView}>
          {t("common.view")}
        </BundlesButton>
      </View>
    </View>
  );
}
