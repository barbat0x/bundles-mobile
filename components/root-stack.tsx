import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";

import { useActiveAccount, useActiveWalletConnectionStatus } from "thirdweb/react-native";

import { uiTokens } from "@/lib/ui-tokens";

/**
 * Root stack + redirect: unauthenticated users go to `/login`,
 * authenticated users can access app screens.
 */
export function RootStack() {
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const account = useActiveAccount();
  const connectionStatus = useActiveWalletConnectionStatus();

  useEffect(() => {
    if (!navigationState?.key) return;
    if (connectionStatus === "connecting") return;

    const inLogin = segments[0] === "login";
    const hasAddress = Boolean(account?.address);

    if (!hasAddress && !inLogin) {
      router.replace("/login");
      return;
    }
    if (hasAddress && inLogin) {
      router.replace("/(tabs)");
    }
  }, [account?.address, connectionStatus, navigationState?.key, router, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="bundle/[address]"
        options={{
          headerShown: true,
          headerTitleStyle: { fontFamily: uiTokens.fontFamily.sansSemibold },
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
