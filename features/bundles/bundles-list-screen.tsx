import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native";
import { useCallback, useState } from "react";
import { useNetInfo } from "@react-native-community/netinfo";

import { AppHeader } from "@/components/app-header";
import { BundleCard } from "@/features/bundles/bundle-card";
import { NetworkSwitch } from "@/components/network-switch";
import {
  useBundleIndexesList,
  useEnrichedBundleList,
} from "@/features/bundles/bundles-queries";
import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { uiTokens } from "@/lib/ui-tokens";
import { useNetworkStore } from "@/store/network-store";

export function BundlesListScreen() {
  const router = useRouter();
  const net = useNetInfo();
  const activeChainId = useNetworkStore((s) => s.activeChainId);
  const q = useBundleIndexesList(activeChainId);
  const enriched = useEnrichedBundleList(q.data, activeChainId);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await q.refetch();
    setRefreshing(false);
  }, [q]);

  if (q.isLoading) {
    return (
      <View className="flex-1 bg-bundle-bg items-center justify-center">
        <ActivityIndicator color={uiTokens.colors.ctaPrimary} />
        <Text className="text-bundle-muted mt-2">Chargement des bundles…</Text>
      </View>
    );
  }

  if (q.isError) {
    return (
      <View className="flex-1 bg-bundle-bg items-center justify-center px-6">
        <Text className="text-bundle-text text-center mb-3">Impossible de charger les bundles.</Text>
        <Text onPress={() => void q.refetch()} className="text-bundle-cta font-medium">
          Réessayer
        </Text>
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
          <Text className="text-amber-900 text-sm">Pas de connexion internet</Text>
        </View>
      ) : null}
      {!enriched.data.length && !q.isLoading ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-bundle-muted text-center">Aucun bundle disponible.</Text>
        </View>
      ) : (
        <FlatList
          data={enriched.data}
          keyExtractor={(item) => item.address}
          contentContainerClassName="p-4 pb-24"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
          renderItem={({ item }) => (
            <BundleCard
              bundle={item}
              chainId={activeChainId}
              onPress={() => router.push(`/bundle/${item.address}`)}
              onView={() => router.push(`/bundle/${item.address}`)}
            />
          )}
        />
      )}
    </View>
  );
}
