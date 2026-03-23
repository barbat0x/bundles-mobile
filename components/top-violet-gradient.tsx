import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

type TopVioletGradientProps = {
  gradientId: string;
  height?: number;
  viewBoxHeight?: number;
};

export function TopVioletGradient({
  gradientId,
  height = 420,
  viewBoxHeight = 420,
}: TopVioletGradientProps) {
  return (
    <Svg width="100%" height={height} viewBox={`0 0 375 ${viewBoxHeight}`} preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={gradientId} x1="50%" y1="0%" x2="50%" y2="100%">
          <Stop offset="0%" stopColor="#8A0294" stopOpacity="0.18" />
          <Stop offset="46%" stopColor="#8A0294" stopOpacity="0.08" />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="375" height={viewBoxHeight} fill={`url(#${gradientId})`} />
    </Svg>
  );
}
