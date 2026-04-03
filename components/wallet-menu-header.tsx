import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Text, View, Pressable } from "react-native";
import { useActiveAccount, useProfiles, useWalletBalance } from "thirdweb/react-native";

import { getThirdwebChain } from "@/lib/chain-runtime";
import { truncateAddress } from "@/lib/format";
import { t } from "@/lib/i18n";
import { getThirdwebBrowserClient } from "@/lib/thirdweb";
import { useNetworkStore } from "@/store/network-store";
import { ConnectWalletButton } from "@/components/connect-wallet-button";

const googleIconUrl = "https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg";

export function WalletMenuHeader() {
  const router = useRouter();
  const account = useActiveAccount();
  const activeChainId = useNetworkStore((s) => s.activeChainId);
  const client = useMemo(() => getThirdwebBrowserClient(), []);
  const chain = useMemo(() => getThirdwebChain(activeChainId), [activeChainId]);
  const profilesQ = useProfiles({ client });
  const ethBal = useWalletBalance({
    address: account?.address,
    chain,
    client,
  });

  const isGoogleLogin = Boolean(profilesQ.data?.some((p) => p.type === "google"));

  return (
    <View className="mb-5 flex-row items-center justify-between">
      <Pressable
        className="h-10 rounded-full bg-[#8A02941A] px-3 flex-row items-center gap-2 active:opacity-80"
        onPress={() => router.push("/settings")}
      >
        {isGoogleLogin ? (
          <Image
            source={{ uri: googleIconUrl }}
            style={{ width: 26, height: 26, borderRadius: 13 }}
            contentFit="cover"
          />
        ) : null}
        <Text className="text-[#8A0294] text-[18px] font-medium">
          {account?.address ? truncateAddress(account.address as `0x${string}`) : "Wallet"}
        </Text>
        <Feather name="chevron-down" size={16} color="#8A0294" />
      </Pressable>

      <View className="h-10 rounded-full bg-[#F7F8FA] border border-[#E5E5E5] px-3 items-center justify-center">
        {account?.address ? (
          <Text className="text-[16px] text-[#181818]">
            {ethBal.data
              ? `${t("common.networkFees")}: ${Number(ethBal.data.displayValue).toFixed(4)} ETH`
              : `${t("common.networkFees")}: 0 ETH`}
          </Text>
        ) : (
          <ConnectWalletButton />
        )}
      </View>
    </View>
  );
}
