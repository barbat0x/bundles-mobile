import { Image } from "expo-image";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useNetInfo } from "@react-native-community/netinfo";
import * as Clipboard from "expo-clipboard";
import { useActiveAccount, useWalletBalance } from "thirdweb/react-native";

import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { getThirdwebChain } from "@/lib/chain-runtime";
import { NetworkSwitch } from "@/components/network-switch";
import { BundlesButton, BundlesCard } from "@/components/ui";

import { AppHeader } from "@/components/app-header";
import { formatPct, formatUsd, truncateAddress } from "@/lib/format";
import { bundleIconUrl } from "@/lib/media";
import { uiTokens } from "@/lib/ui-tokens";
import { getThirdwebBrowserClient } from "@/lib/thirdweb";
import {
  sumPortfolioUsd,
  useEnrichedPositions,
  useUserPositions,
} from "@/features/portfolio/portfolio-queries";
import { useCallback, useState } from "react";
import { useNetworkStore } from "@/store/network-store";

export function PortfolioScreen() {
  const router = useRouter();
  const account = useActiveAccount();
  const net = useNetInfo();
  const activeChainId = useNetworkStore((s) => s.activeChainId);
  const chain = getThirdwebChain(activeChainId);
  const client = getThirdwebBrowserClient();
  const posQ = useUserPositions(account?.address, activeChainId);
  const { rows, isLoading: enrichLoading } = useEnrichedPositions(posQ.data, activeChainId);
  const [refreshing, setRefreshing] = useState(false);

  const ethBal = useWalletBalance({
    address: account?.address,
    chain,
    client,
  });

  const total = sumPortfolioUsd(rows);
  const dayW = rows.reduce((s, r) => s + (r.stats?.priceVariations?.lastDay ?? 0), 0) / (rows.length || 1);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await posQ.refetch();
    await ethBal.refetch();
    setRefreshing(false);
  }, [ethBal, posQ]);

  if (!account?.address) {
    return (
      <View className="flex-1 bg-bundle-bg items-center justify-center px-6">
        <Text className="text-bundle-text mb-4 text-center">Connectez-vous pour voir le portfolio.</Text>
        <ConnectWalletButton />
      </View>
    );
  }

  const offline = net.isConnected === false;

  return (
    <View className="flex-1 bg-bundle-bg">
      <AppHeader right={<ConnectWalletButton />} />
      <View className="px-4 py-2">
        <NetworkSwitch />
      </View>
      {offline ? (
        <View className="bg-amber-100 px-4 py-2">
          <Text className="text-amber-900 text-sm">Dernière sync peut être obsolète (hors ligne)</Text>
        </View>
      ) : null}

      {posQ.isLoading || enrichLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={uiTokens.colors.ctaPrimary} />
        </View>
      ) : rows.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-bundle-muted text-center mb-4">Vous n&apos;avez pas encore de bundles.</Text>
          <BundlesButton variant="primary" onPress={() => router.replace("/")}>
            Découvrir les bundles
          </BundlesButton>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.bundleAddress}
          ListHeaderComponent={
            <BundlesCard className="mb-4 p-4">
              <Text className="text-bundle-muted text-sm">Valeur totale</Text>
              <Text className="text-2xl font-semibold text-bundle-text font-outfit-semibold">{formatUsd(total)}</Text>
              <Text
                style={{
                  color:
                    dayW >= 0 ? uiTokens.colors.success : uiTokens.colors.danger,
                }}
                className="mt-1 font-mono"
              >
                {formatPct(dayW).text} (approx. 24h)
              </Text>
              <Pressable
                onPress={() => void Clipboard.setStringAsync(account.address)}
                className="mt-4"
              >
                <Text className="text-bundle-muted text-sm">
                  Wallet {truncateAddress(account.address as `0x${string}`)}
                </Text>
                <Text className="text-bundle-link text-sm">Copier</Text>
              </Pressable>
              <Text className="text-bundle-muted text-sm mt-2">Solde ETH</Text>
              <Text className="text-bundle-text font-mono">
                {ethBal.data ? `${ethBal.data.displayValue} ${ethBal.data.symbol}` : "—"}
              </Text>
            </BundlesCard>
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
          contentContainerClassName="p-4 pb-24"
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/trade",
                  params: { bundle: item.bundleAddress },
                })
              }
              className="bg-bundle-card border border-bundle-border-subtle rounded-md p-3 mb-3 flex-row gap-3 active:opacity-95"
            >
              <Image
                source={{ uri: bundleIconUrl(item.bundleAddress, activeChainId) }}
                style={{ width: 44, height: 44, borderRadius: 10 }}
              />
              <View className="flex-1">
                <Text className="text-bundle-text font-medium">
                  {item.index.name} ({item.index.symbol})
                </Text>
                <Text className="text-bundle-muted text-sm">
                  {formatUsd(item.valueUsd)} ·{" "}
                  <Text
                    style={{
                      color:
                        item.pnlUsd >= 0 ? uiTokens.colors.success : uiTokens.colors.danger,
                    }}
                  >
                    {formatUsd(item.pnlUsd)} 24h
                  </Text>
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
