import { useMemo, useState } from "react";
import { Platform, useColorScheme, View } from "react-native";
import type { Address } from "viem";
import { SvgUri } from "react-native-svg";
import { Image } from "expo-image";

import TokenGenericFaded from "@/assets/utility/token-generic-faded.svg";
import TokenGenericFadedDark from "@/assets/utility/token-generic-faded-dark.svg";
import { getErc20TokenIconUrl } from "@/lib/media";

export type TokenIconProps = {
  chainId: number;
  tokenAddress: Address | string;
  size?: number;
};

/**
 * ERC-20 token icon: loads SVG from the media CDN (same source as web)
 * and falls back to the generic token icon variant (light/dark).
 */
export function TokenIcon({ chainId, tokenAddress, size = 32 }: TokenIconProps) {
  const scheme = useColorScheme();
  const uri = useMemo(() => getErc20TokenIconUrl(chainId, tokenAddress), [chainId, tokenAddress]);
  const [hasError, setHasError] = useState(false);

  const Fallback = scheme === "dark" ? TokenGenericFadedDark : TokenGenericFaded;

  const onLoad = () => setHasError(false);
  const onError = () => setHasError(true);

  if (Platform.OS === "web") {
    return (
      <View style={{ width: size, height: size }} accessibilityRole="image">
        {!hasError ? (
          <Image
            source={{ uri }}
            style={{ width: size, height: size }}
            contentFit="contain"
            onLoad={onLoad}
            onError={onError}
          />
        ) : (
          <Fallback width={size} height={size} />
        )}
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size }} accessibilityRole="image">
      <SvgUri
        uri={uri}
        width={size}
        height={size}
        onLoad={onLoad}
        onError={onError}
        fallback={<Fallback width={size} height={size} />}
      />
    </View>
  );
}
