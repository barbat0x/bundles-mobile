import { useMemo } from "react";
import { useColorScheme, View } from "react-native";
import type { Address } from "viem";
import { SvgUri } from "react-native-svg";

import TokenGenericFaded from "@/assets/utility/token-generic-faded.svg";
import TokenGenericFadedDark from "@/assets/utility/token-generic-faded-dark.svg";
import { getErc20TokenIconUrl } from "@/lib/media";

export type TokenIconProps = {
  chainId: number;
  tokenAddress: Address | string;
  size?: number;
};

/**
 * Icône token ERC-20 : charge le SVG sur le CDN media (comme le web), avec fallback
 * `token-generic-faded` (clair / sombre) comme `TokenIcon.vue`.
 */
export function TokenIcon({ chainId, tokenAddress, size = 32 }: TokenIconProps) {
  const scheme = useColorScheme();
  const uri = useMemo(() => getErc20TokenIconUrl(chainId, tokenAddress), [chainId, tokenAddress]);

  const Fallback = scheme === "dark" ? TokenGenericFadedDark : TokenGenericFaded;

  return (
    <View style={{ width: size, height: size }} accessibilityRole="image">
      <SvgUri
        uri={uri}
        width={size}
        height={size}
        fallback={<Fallback width={size} height={size} />}
      />
    </View>
  );
}
