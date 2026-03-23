import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BundlesLogo } from "@/assets/brand/bundles-brand";
import { ConnectWalletButton } from "@/components/connect-wallet-button";

/**
 * Point d’entrée si aucun compte thirdweb : connexion obligatoire pour accéder au reste de l’app.
 * La redirection vers `/(tabs)` est gérée par `RootStack` une fois connecté.
 */
export default function LoginScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 bg-bundle-bg px-6"
      style={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
    >
      <View className="flex-1 justify-center items-center">
        <View className="mb-6 items-center" accessibilityRole="header" accessibilityLabel="bundles.fi">
          <BundlesLogo width={220} height={46} accessibilityLabel="" />
        </View>
        <Text className="text-bundle-muted text-center mb-10 max-w-sm">
          Connectez un wallet pour lister les bundles, trader et gérer votre portfolio.
        </Text>
        <View className="w-full max-w-sm">
          <ConnectWalletButton />
        </View>
      </View>
    </View>
  );
}
