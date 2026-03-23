import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { Alert, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import * as LocalAuth from "expo-local-authentication";
import Constants from "expo-constants";
import { Feather } from "@expo/vector-icons";
import { useActiveAccount, useActiveWallet, useDisconnect } from "thirdweb/react-native";

import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { WalletMenuHeader } from "@/components/wallet-menu-header";
import { TopVioletGradient } from "@/components/top-violet-gradient";
import { BundlesButton } from "@/components/ui";

import { truncateAddress } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cardShadow, pageVioletBg } from "@/lib/ui-shell";

export function SettingsScreen() {
  const router = useRouter();
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();

  const onCopy = async () => {
    if (account?.address) await Clipboard.setStringAsync(account.address);
  };

  const onExportNote = async () => {
    if (Platform.OS !== "web") {
      const authResult = await LocalAuth.authenticateAsync({ promptMessage: t("settings.authPrompt") });
      if (!authResult.success) return;
    }
    Alert.alert(
      t("settings.exportAlertTitle"),
      t("settings.exportAlertMessage"),
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: pageVioletBg }}>
      <View className="absolute top-0 left-0 right-0">
        <TopVioletGradient gradientId="settingsTopVioletFade" />
      </View>

      <ScrollView contentContainerClassName="px-[14px] pt-[52px] pb-16 gap-4">
        <WalletMenuHeader />
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 rounded-full bg-[#F7F8FA] border border-[#E5E5E5] items-center justify-center"
          style={cardShadow}
        >
          <Feather name="chevron-left" size={20} color="#181818" />
        </Pressable>
        <View className="rounded-[20px] bg-white p-4" style={cardShadow}>
          <Text className="text-bundle-muted text-sm mb-2">{t("settings.address")}</Text>
          <Pressable onPress={() => void onCopy()} className="rounded-[12px] border border-[#E5E5E5] bg-[#F7F8FA] p-3 active:opacity-80">
            <Text className="text-bundle-text">
              {account?.address ? truncateAddress(account.address as `0x${string}`) : t("common.disconnected")}
            </Text>
            <Text className="text-bundle-link text-sm mt-1">{t("common.copy")}</Text>
          </Pressable>

          <View className="mt-4">
            <ConnectWalletButton />
          </View>

          <Pressable onPress={() => void onExportNote()} className="mt-4 rounded-[12px] border border-[#E5E5E5] bg-[#F7F8FA] p-3 active:opacity-80">
            <Text className="text-bundle-text font-medium">{t("settings.exportPrivateKey")}</Text>
            <Text className="text-bundle-muted text-sm mt-1">{t("settings.exportPrivateKeyHint")}</Text>
          </Pressable>

          <BundlesButton
            variant="primary"
            className="w-full h-16 rounded-[20px] mt-4 bg-[#8A0294] border-0"
            onPress={() => {
              if (wallet) disconnect(wallet);
              router.replace("/login");
            }}
          >
            {t("settings.signOut")}
          </BundlesButton>
        </View>

        <Text className="text-bundle-muted text-xs mt-2">
          {t("common.version")} {Constants.expoConfig?.version ?? "1.0.0"}
        </Text>
        <Pressable onPress={() => void Linking.openURL("https://bundles.fi")}>
          <Text className="text-bundle-link">bundles.fi</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
