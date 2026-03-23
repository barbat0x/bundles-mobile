import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import * as LocalAuth from "expo-local-authentication";
import Constants from "expo-constants";
import { useActiveAccount, useActiveWallet, useDisconnect } from "thirdweb/react-native";

import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { BundlesButton, BundlesCard } from "@/components/ui";

import { truncateAddress } from "@/lib/format";

export function SettingsScreen() {
  const router = useRouter();
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();

  const onCopy = async () => {
    if (account?.address) await Clipboard.setStringAsync(account.address);
  };

  const onExportNote = async () => {
    const ok = await LocalAuth.authenticateAsync({ promptMessage: "Confirmer votre identité" });
    if (!ok.success) return;
    Alert.alert(
      "Exporter la clé",
      "Utilisez le bouton Compte thirdweb ci-dessous : les options d’export de clé privée sont gérées dans le flux de wallet intégré après connexion.",
    );
  };

  return (
    <View className="flex-1 bg-bundle-bg">
      <ScrollView contentContainerClassName="p-4 gap-4">
        <Text className="text-bundle-muted text-sm">Adresse</Text>
        <Pressable onPress={() => void onCopy()}>
          <BundlesCard className="p-3">
            <Text className="text-bundle-text">
              {account?.address ? truncateAddress(account.address as `0x${string}`) : "Non connecté"}
            </Text>
            <Text className="text-bundle-link text-sm mt-1">Copier</Text>
          </BundlesCard>
        </Pressable>

        <ConnectWalletButton />

        <Pressable onPress={() => void onExportNote()}>
          <BundlesCard className="p-3">
            <Text className="text-bundle-text font-medium">Exporter la clé privée</Text>
            <Text className="text-bundle-muted text-sm mt-1">Protégé par biométrie — voir instructions</Text>
          </BundlesCard>
        </Pressable>

        <BundlesButton
          variant="danger"
          className="w-full"
          onPress={() => {
            if (wallet) disconnect(wallet);
            router.replace("/login");
          }}
        >
          Déconnexion
        </BundlesButton>

        <Text className="text-bundle-muted text-xs mt-4">
          Version {Constants.expoConfig?.version ?? "1.0.0"}
        </Text>
        <Pressable onPress={() => void Linking.openURL("https://bundles.fi")}>
          <Text className="text-bundle-link">bundles.fi</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
