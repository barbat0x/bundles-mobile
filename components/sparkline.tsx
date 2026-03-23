import { View } from "react-native";
import Svg, { Polyline } from "react-native-svg";

import { uiTokens } from "@/lib/ui-tokens";

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
}

export function Sparkline({ values, width = 72, height = 28 }: SparklineProps) {
  if (values.length < 2) {
    return <View style={{ width, height }} className="bg-bundle-border/40 rounded-md" />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / span) * height;
      return `${x},${y}`;
    })
    .join(" ");
  const positive = values[values.length - 1] >= values[0];
  const stroke = positive ? uiTokens.colors.success : uiTokens.colors.danger;
  return (
    <Svg width={width} height={height}>
      <Polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" />
    </Svg>
  );
}
