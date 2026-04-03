import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import Svg, { Polyline } from "react-native-svg";

import { BundlesSegmented } from "@/components/ui";
import type { HistoryTimeframe } from "@/services/bundles-ws/token-api";
import { uiTokens } from "@/lib/ui-tokens";
import { t } from "@/lib/i18n";
import { formatFiatAmount } from "@/lib/format";
import { useUsdToFiatRate } from "@/hooks/use-fiat-display";

import type { PricePoint } from "@/types";

const PERIODS: { key: HistoryTimeframe; label: string }[] = [
  { key: "day", label: "1D" },
  { key: "week", label: "7D" },
  { key: "month", label: "1M" },
  { key: "year", label: "1Y" },
  { key: "all", label: "All" },
];

interface PriceChartProps {
  data: PricePoint[];
  loading?: boolean;
  timeframe: HistoryTimeframe;
  onChangeTimeframe: (t: HistoryTimeframe) => void;
}

export function PriceChart({ data, loading, timeframe, onChangeTimeframe }: PriceChartProps) {
  const [w, setW] = useState(280);
  const { fiatCurrency, usdToFiatRate } = useUsdToFiatRate();
  const h = 140;
  const pts = useMemo(() => {
    if (data.length < 2) return "";
    const prices = data.map((p) => p.priceUSD);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const span = max - min || 1;
    return data
      .map((p, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - ((p.priceUSD - min) / span) * h;
        return `${x},${y}`;
      })
      .join(" ");
  }, [data, w]);

  const last = data[data.length - 1]?.priceUSD;

  return (
    <View className="bg-bundle-card rounded-md border border-bundle-border-subtle p-3">
      <BundlesSegmented
        className="mb-2"
        variant="muted"
        value={timeframe}
        onChange={onChangeTimeframe}
        options={PERIODS.map((p) => ({ value: p.key, label: p.label }))}
      />
      <View
        onLayout={(e) => setW(Math.max(200, e.nativeEvent.layout.width))}
        className="items-center"
      >
        {loading ? (
          <Text className="text-bundle-muted">{t("chart.loading")}</Text>
        ) : pts ? (
          <Svg width={w} height={h}>
            <Polyline points={pts} fill="none" stroke={uiTokens.colors.chartLine} strokeWidth="2" />
          </Svg>
        ) : (
          <Text className="text-bundle-muted">{t("chart.notEnoughData")}</Text>
        )}
      </View>
      {last !== undefined ? (
        <Text className="text-bundle-muted text-sm mt-2 font-mono">
          {t("chart.priceLabel")}: {formatFiatAmount(last * usdToFiatRate, fiatCurrency)}
        </Text>
      ) : null}
    </View>
  );
}
