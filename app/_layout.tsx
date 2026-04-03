import {
  AzeretMono_400Regular,
  AzeretMono_500Medium,
} from "@expo-google-fonts/azeret-mono";
import {
  Outfit_300Light,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  useFonts as useOutfitFonts,
} from "@expo-google-fonts/outfit";
import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Text } from "react-native";
import { install as installQuickCrypto } from "react-native-quick-crypto";
import "react-native-reanimated";

import { ThirdwebProvider } from "thirdweb/react-native";

import { RootStack } from "@/components/root-stack";
import { uiTokens } from "@/lib/ui-tokens";
import { AppQueryProvider } from "@/providers/query-provider";

import "../global.css";

export { ErrorBoundary } from "expo-router";

installQuickCrypto();

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useOutfitFonts({
    Outfit_300Light,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    AzeretMono_400Regular,
    AzeretMono_500Medium,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  /** Default body font — matches bundles-frontend `global.css` (Outfit 300). */
  useEffect(() => {
    if (!loaded) return;
    const T = Text as typeof Text & { defaultProps?: { style?: unknown } };
    const prev = T.defaultProps?.style;
    T.defaultProps = {
      ...T.defaultProps,
      style: [prev, { fontFamily: uiTokens.fontFamily.sans }].flat().filter(Boolean),
    };
  }, [loaded]);

  if (!loaded) return null;

  return (
    <ThirdwebProvider>
      <AppQueryProvider>
        <ThemeProvider value={DefaultTheme}>
          <RootStack />
        </ThemeProvider>
      </AppQueryProvider>
    </ThirdwebProvider>
  );
}
