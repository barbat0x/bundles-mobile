import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BundlesFavicon } from "@/assets/brand/bundles-brand";
import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { TopVioletGradient } from "@/components/top-violet-gradient";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 bg-white"
      style={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 25 }}
    >
      <View className="absolute top-0 left-0 right-0">
          <TopVioletGradient gradientId="topVioletFade" height={470} viewBoxHeight={470} />
      </View>

      <View className="flex-1">
        <View className="flex-1 items-center justify-center">
          <View className="mb-10 items-center" accessibilityRole="header" accessibilityLabel="bundles.fi">
            <View className="w-[156px] h-[156px] rounded-full overflow-hidden">
              <BundlesFavicon width={156} height={156} />
            </View>
          </View>
          <Text className="text-black text-center text-[28px] leading-[34px] font-semibold mb-16 max-w-[300px]">
            Invest in crypto ETFs.
          </Text>
        </View>

        <View className="pb-5">
          <View
            className="relative h-16 rounded-[20px] overflow-visible"
            style={{
              shadowColor: "#000000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.12,
              shadowRadius: 12,
              elevation: 4,
            }}
          >
            <View className="absolute inset-0 rounded-[20px]" style={{ backgroundColor: "#8A0294" }} />
            <View className="absolute inset-0 justify-center">
              <ConnectWalletButton variant="onboarding" label="Connect Wallet" />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
