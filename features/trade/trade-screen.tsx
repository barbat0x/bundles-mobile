import { buyBundle, quoteBundles, sellBundle } from "@/services/universal-router-client";
import { TX_DEADLINE_SECONDS } from "@/lib/contracts";
import * as WebBrowser from "expo-web-browser";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useActiveAccount } from "thirdweb/react-native";

import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { parseUnits, type Address } from "viem";

import { AppHeader } from "@/components/app-header";
import { BundlesButton, BundlesSegmented, BundlesTextInput } from "@/components/ui";
import { NetworkSwitch } from "@/components/network-switch";
import { getThirdwebChain } from "@/lib/chain-runtime";
import { formatEthFromWei, formatBundleAmount } from "@/lib/format";
import { uiTokens } from "@/lib/ui-tokens";
import { isOnRampEnabledChain } from "@/lib/chains";
import { isThirdwebPayTestMode } from "@/lib/env";
import {
  clearPurchaseIntent,
  loadPurchaseIntent,
  savePurchaseIntent,
  type PurchaseIntent,
} from "@/lib/purchase-intent";
import {
  defaultOnRampFiatCurrency,
  ONRAMP_FIAT_OPTIONS,
  type OnRampFiatCurrencyCode,
  coingeckoVsForFiat,
} from "@/lib/fiat-onramp-currencies";
import { fetchEthPriceInFiat } from "@/services/prices/eth-fiat";
import { fetchBuyWithFiatIntentStatus, quoteFiatToEthOnramp } from "@/services/trade/fiat-onramp";
import { fetchEthUsdCoingeckoCached } from "@/services/prices/eth-usd";
import { computeModeAFundsState, ethWeiFromUsdReserve } from "@/services/trade/mode-a-funds-state";
import { executeBuy } from "@/services/trade/execute-buy";
import { executeSell } from "@/services/trade/execute-sell";
import { getThirdwebBrowserClient } from "@/lib/thirdweb";
import { getViemPublicClient } from "@/lib/viem-singleton";
import { useNetworkStore } from "@/store/network-store";
import { useTradeUiStore } from "@/store/trade-ui-store";
import { fetchBundleIndexesList, useBundleIndexesList } from "@/features/bundles/bundles-queries";
import { queryConfig } from "@/lib/query-config";
import { useDebounce } from "@/hooks/use-debounce";
import { isBundleAddressAllowed } from "@/lib/bundle-allowlist";
import {
  clampSlippageBps,
  DEFAULT_SLIPPAGE_BPS,
  SLIPPAGE_BPS_MAX,
  SLIPPAGE_BPS_MIN,
  toSlippageBpsBigint,
} from "@/lib/slippage";
import { getModeAGasBufferWei, POST_ONRAMP_RESERVE_USD, SLIPPAGE_BPS } from "@/lib/contracts";

type ModeBDirection = "buy" | "sell";

function randomId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function TradeScreen() {
  const params = useLocalSearchParams<{ bundle?: string }>();
  const account = useActiveAccount();
  const activeChainId = useNetworkStore((s) => s.activeChainId);
  const qc = useQueryClient();
  const twChain = getThirdwebChain(activeChainId);
  const onRampEnabled = isOnRampEnabledChain(activeChainId);
  const thirdwebPayTestMode = isThirdwebPayTestMode();
  const client = getThirdwebBrowserClient();
  const pub = getViemPublicClient(activeChainId);

  const { tradeTabMode, setTradeTabMode, slippageBps, setSlippageBps } = useTradeUiStore();
  const bundlesQ = useBundleIndexesList(activeChainId);
  const bundles = useMemo(() => bundlesQ.data ?? [], [bundlesQ.data]);

  const [selected, setSelected] = useState<string | undefined>(
    typeof params.bundle === "string" ? params.bundle : undefined,
  );
  useEffect(() => {
    if (typeof params.bundle === "string") setSelected(params.bundle);
  }, [params.bundle]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<PurchaseIntent | null>(null);
  const autoSwapIntentInFlight = useRef<string | null>(null);

  useEffect(() => {
    void loadPurchaseIntent().then(setPendingIntent);
  }, []);

  useEffect(() => {
    if (!onRampEnabled && tradeTabMode === "cb") {
      setTradeTabMode("swap");
    }
  }, [onRampEnabled, setTradeTabMode, tradeTabMode]);

  const index = useMemo(
    () => bundles.find((b) => b.address.toLowerCase() === selected?.toLowerCase()),
    [bundles, selected],
  );
  const decimals = index?.decimals ?? 18;

  const [fiatAmountText, setFiatAmountText] = useState("100");
  const [fiatCurrency, setFiatCurrency] = useState<OnRampFiatCurrencyCode>(defaultOnRampFiatCurrency);
  const debouncedFiatAmount = useDebounce(fiatAmountText, 500);
  const modeAEstimate = useQuery({
    enabled:
      onRampEnabled &&
      tradeTabMode === "cb" &&
      Boolean(selected) &&
      Number(debouncedFiatAmount) > 0,
    queryKey: ["modeA", "est", activeChainId, selected, debouncedFiatAmount, fiatCurrency],
    queryFn: async () => {
      const fiatNum = Number(debouncedFiatAmount);
      if (!selected || !Number.isFinite(fiatNum)) throw new Error("invalid");
      let ethWei: bigint | null = null;

      if (account?.address) {
        try {
          const qFiat = await quoteFiatToEthOnramp({
            client,
            chainId: activeChainId,
            walletAddress: account.address,
            fiatAmount: debouncedFiatAmount,
            fiatCurrency,
          });
          ethWei = BigInt(qFiat.onRampToken.amountWei);
        } catch {
          // Non-blocking fallback to public price estimation.
        }
      }

      if (ethWei === null) {
        const ethInFiat = await fetchEthPriceInFiat(coingeckoVsForFiat(fiatCurrency));
        const ethFloat = fiatNum / ethInFiat;
        ethWei = BigInt(Math.floor(ethFloat * 1e18));
      }

      const [q] = await quoteBundles(pub, [selected as Address]);
      const weiPerToken = q.singleTokenValueETH;
      const estTokens = weiPerToken > 0n ? Number(ethWei) / Number(weiPerToken) : 0;
      const desiredHuman = estTokens;
      const desiredWei =
        desiredHuman > 0
          ? parseUnits(desiredHuman.toFixed(Math.min(decimals, 8)), decimals)
          : 0n;
      let ethCost = 0n;
      if (desiredWei > 0n) {
        const b = await buyBundle(pub, selected as Address, desiredWei, {
          deadline: BigInt(TX_DEADLINE_SECONDS),
        });
        ethCost = b.ethCost;
      }
      return {
        fiatAmount: fiatNum,
        fiatCurrency,
        estTokens: desiredHuman,
        desiredWei,
        ethCost,
      };
    },
  });

  const [modeBDir, setModeBDir] = useState<ModeBDirection>("buy");
  const [amountText, setAmountText] = useState("");
  const debouncedAmt = useDebounce(amountText, 500);
  const amountWei = useMemo(() => {
    try {
      if (!debouncedAmt || Number(debouncedAmt) <= 0) return 0n;
      return parseUnits(debouncedAmt, decimals);
    } catch {
      return 0n;
    }
  }, [debouncedAmt, decimals]);

  const modeBQuote = useQuery({
    enabled: tradeTabMode === "swap" && amountWei > 0n && Boolean(selected),
    queryKey: ["modeB", "q", activeChainId, selected, amountWei.toString(), modeBDir],
    queryFn: async () => {
      if (!selected) throw new Error("no bundle");
      if (modeBDir === "buy") {
        return buyBundle(pub, selected as Address, amountWei, {
          deadline: BigInt(TX_DEADLINE_SECONDS),
        });
      }
      return sellBundle(pub, selected as Address, amountWei, {
        deadline: BigInt(TX_DEADLINE_SECONDS),
      });
    },
    staleTime: 5000,
    refetchInterval: 15_000,
  });

  const modeAOnRampStatusQuery = useQuery({
    enabled: Boolean(
      pendingIntent &&
        pendingIntent.chainId === activeChainId &&
        pendingIntent.status === "payment_pending" &&
        pendingIntent.onRampIntentId,
    ),
    queryKey: ["modeA", "onramp-status", pendingIntent?.onRampIntentId ?? "none"],
    queryFn: async () => {
      if (!pendingIntent?.onRampIntentId) return "NONE";
      const s = await fetchBuyWithFiatIntentStatus({
        client,
        intentId: pendingIntent.onRampIntentId,
      });
      return s.status;
    },
    refetchInterval: 5000,
    staleTime: 0,
  });

  const modeAFundsReadyQuery = useQuery({
    enabled: Boolean(
      account?.address &&
        pendingIntent?.status === "funds_pending" &&
        pendingIntent.chainId === activeChainId,
    ),
    queryKey: [
      "modeA",
      "eth-ready",
      account?.address ?? "0x",
      pendingIntent?.id ?? "none",
      activeChainId,
      pendingIntent?.desiredBundleAmount,
      slippageBps,
    ],
    queryFn: async () => {
      if (!account?.address || !pendingIntent) {
        return { ready: false as const, bundleOutWei: 0n };
      }
      const bal = await pub.getBalance({
        address: account.address as Address,
      });
      const bps = toSlippageBpsBigint(BigInt(clampSlippageBps(slippageBps)), SLIPPAGE_BPS);
      const gasBuffer = getModeAGasBufferWei(activeChainId);

      let spendReserveWei = 0n;
      if (activeChainId === 1) {
        try {
          const px = await fetchEthUsdCoingeckoCached();
          spendReserveWei = ethWeiFromUsdReserve(POST_ONRAMP_RESERVE_USD, px);
        } catch {
          spendReserveWei = 10n ** 15n;
        }
      }

      return computeModeAFundsState({
        publicClient: pub,
        bundleAddress: pendingIntent.bundleAddress as Address,
        targetBundleOutWei: BigInt(pendingIntent.desiredBundleAmount),
        slippageBps: bps,
        balanceWei: bal,
        gasBufferWei: gasBuffer,
        spendReserveWei,
      });
    },
    refetchInterval: 5000,
    staleTime: 0,
  });

  const swapMutation = useMutation({
    mutationFn: async () => {
      if (!account || !selected) throw new Error("Wallet ou bundle requis");
      if (!isBundleAddressAllowed(selected as Address, bundles)) {
        throw new Error("Ce token n’est pas un bundle listé");
      }
      const b = BigInt(clampSlippageBps(slippageBps));
      if (amountWei <= 0n) throw new Error("Montant requis");
      if (modeBDir === "buy") {
        return executeBuy({
          publicClient: pub,
          twClient: client,
          twChain,
          chainId: activeChainId,
          account,
          bundleAddress: selected as Address,
          desiredBundleAmount: amountWei,
          slippageBps: b,
        });
      }
      return executeSell({
        publicClient: pub,
        twClient: client,
        twChain,
        chainId: activeChainId,
        account,
        bundleAddress: selected as Address,
        bundleAmountIn: amountWei,
        slippageBps: b,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries();
      setAmountText("");
    },
  });

  const openOnrampMutation = useMutation({
    mutationFn: async () => {
      if (!account?.address) throw new Error("Connectez un wallet");
      if (!selected || !modeAEstimate.data?.desiredWei) throw new Error("Quote requise");
      const qFiat = await quoteFiatToEthOnramp({
        client,
        chainId: activeChainId,
        walletAddress: account.address,
        fiatAmount: debouncedFiatAmount,
        fiatCurrency,
      });
      const intent: PurchaseIntent = {
        id: randomId(),
        chainId: activeChainId,
        bundleAddress: selected as Address,
        desiredBundleAmount: modeAEstimate.data.desiredWei.toString(),
        expectedEthCost: modeAEstimate.data.ethCost.toString(),
        onRampIntentId: qFiat.intentId,
        status: "payment_pending",
        createdAt: Date.now(),
      };
      await savePurchaseIntent(intent);
      setPendingIntent(intent);
      await WebBrowser.openBrowserAsync(qFiat.onRampLink);
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      const intent = pendingIntent ?? (await loadPurchaseIntent());
      if (!intent || !account) throw new Error("Pas d’achat en attente");
      if (intent.chainId !== activeChainId) {
        throw new Error("Intent one-click créé sur un autre réseau");
      }
      await savePurchaseIntent({ ...intent, status: "swapping" });
      setPendingIntent({ ...intent, status: "swapping" });
      const list = await qc.ensureQueryData({
        ...queryConfig.bundlesList(activeChainId),
        queryFn: () => fetchBundleIndexesList(activeChainId),
      });
      if (!isBundleAddressAllowed(intent.bundleAddress, list)) {
        throw new Error("Ce token n’est pas un bundle listé");
      }

      const bal = await pub.getBalance({ address: account.address as Address });
      const bps = toSlippageBpsBigint(BigInt(clampSlippageBps(slippageBps)), SLIPPAGE_BPS);
      const gasBuffer = getModeAGasBufferWei(activeChainId);
      let spendReserveWei = 0n;
      if (activeChainId === 1) {
        try {
          const px = await fetchEthUsdCoingeckoCached();
          spendReserveWei = ethWeiFromUsdReserve(POST_ONRAMP_RESERVE_USD, px);
        } catch {
          spendReserveWei = 10n ** 15n;
        }
      }
      const { ready, bundleOutWei } = await computeModeAFundsState({
        publicClient: pub,
        bundleAddress: intent.bundleAddress as Address,
        targetBundleOutWei: BigInt(intent.desiredBundleAmount),
        slippageBps: bps,
        balanceWei: bal,
        gasBufferWei: gasBuffer,
        spendReserveWei,
      });
      if (!ready || bundleOutWei <= 0n) {
        throw new Error("Solde insuffisant après réserve ETH (~2 $) et gas");
      }

      await executeBuy({
        publicClient: pub,
        twClient: client,
        twChain,
        chainId: activeChainId,
        account,
        bundleAddress: intent.bundleAddress,
        desiredBundleAmount: bundleOutWei,
        slippageBps: BigInt(clampSlippageBps(slippageBps)),
      });
      await clearPurchaseIntent();
      setPendingIntent(null);
      await qc.invalidateQueries();
    },
    onError: async () => {
      const intent = pendingIntent ?? (await loadPurchaseIntent());
      if (!intent) return;
      await savePurchaseIntent({ ...intent, status: "swap_failed" });
      setPendingIntent({ ...intent, status: "swap_failed" });
    },
  });

  useEffect(() => {
    if (!pendingIntent || pendingIntent.chainId !== activeChainId || pendingIntent.status !== "payment_pending") return;
    if (modeAOnRampStatusQuery.data === "ON_RAMP_TRANSFER_COMPLETED") {
      const next = { ...pendingIntent, status: "funds_pending" as const };
      void savePurchaseIntent(next);
      setPendingIntent(next);
      return;
    }
    if (modeAOnRampStatusQuery.data === "PAYMENT_FAILED") {
      const next = { ...pendingIntent, status: "payment_failed" as const };
      void savePurchaseIntent(next);
      setPendingIntent(next);
    }
  }, [activeChainId, modeAOnRampStatusQuery.data, pendingIntent]);

  useEffect(() => {
    if (!pendingIntent || pendingIntent.chainId !== activeChainId || pendingIntent.status !== "funds_pending") return;
    if (!modeAFundsReadyQuery.data?.ready || resumeMutation.isPending) return;
    if (autoSwapIntentInFlight.current === pendingIntent.id) return;
    autoSwapIntentInFlight.current = pendingIntent.id;
    void resumeMutation.mutateAsync().finally(() => {
      autoSwapIntentInFlight.current = null;
    });
  }, [activeChainId, modeAFundsReadyQuery.data, pendingIntent, resumeMutation]);

  const primaryDisabled =
    !account ||
    bundlesQ.isLoading ||
    !index ||
    (tradeTabMode === "swap" &&
      (amountWei <= 0n || modeBQuote.isLoading || modeBQuote.isError || swapMutation.isPending)) ||
    (tradeTabMode === "cb" &&
      (!onRampEnabled || modeAEstimate.isLoading || modeAEstimate.isError || openOnrampMutation.isPending));

  const onPrimary = useCallback(async () => {
    if (tradeTabMode === "swap") {
      await swapMutation.mutateAsync();
      return;
    }
    if (!onRampEnabled) {
      throw new Error("On-ramp indisponible sur ce réseau");
    }
    await openOnrampMutation.mutateAsync();
  }, [onRampEnabled, openOnrampMutation, swapMutation, tradeTabMode]);

  return (
    <View className="flex-1 bg-bundle-bg">
      <AppHeader right={<ConnectWalletButton />} />
      <View className="px-4 py-2">
        <NetworkSwitch />
      </View>
      <ScrollView contentContainerClassName="p-4 pb-32" keyboardShouldPersistTaps="handled">
        {pendingIntent ? (
          <View className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4">
            <Text className="text-amber-900 mb-2">
              {pendingIntent.status === "swapping"
                ? "ETH détecté. Achat bundle en cours..."
                : pendingIntent.status === "payment_pending"
                  ? "Paiement en cours de confirmation (on-ramp). Le swap se lancera ensuite automatiquement."
                  : pendingIntent.status === "payment_failed"
                    ? "Le paiement on-ramp a échoué. Réessayez un nouvel achat."
                    : pendingIntent.status === "swap_failed"
                      ? "Le swap auto a échoué. Aucun retry auto n'est relancé."
                      : "ETH reçus. Le swap bundle va se lancer automatiquement."}
            </Text>
            {resumeMutation.isPending ? <ActivityIndicator color={uiTokens.colors.ctaPrimary} /> : null}
          </View>
        ) : null}

        <View className="mb-4">
          <Text className="text-bundle-muted text-sm mb-2">Source des fonds</Text>
          <BundlesSegmented<"cb" | "swap">
            variant="emphasis"
            options={[
              { value: "cb", label: "Carte" },
              { value: "swap", label: "Wallet" },
            ]}
            value={tradeTabMode}
            onChange={(m) => {
              if (m === "cb" && !onRampEnabled) return;
              setTradeTabMode(m);
            }}
          />
        </View>

        <Text className="text-bundle-muted text-sm mb-1">Bundle</Text>
        <Pressable
          onPress={() => setPickerOpen(true)}
          className="border border-bundle-border-subtle bg-bundle-card rounded-md p-3 mb-4"
        >
          <Text className="text-bundle-text">
            {index ? `${index.name} (${index.symbol})` : "Sélectionner…"}
          </Text>
        </Pressable>

        {tradeTabMode === "cb" ? (
          <View className="mb-6">
            {!onRampEnabled ? (
              <Text className="text-red-600 mb-2">
                Mode carte disponible uniquement sur Ethereum pour le moment.
              </Text>
            ) : null}
            {onRampEnabled && thirdwebPayTestMode ? (
              <View className="bg-sky-50 border border-sky-200 rounded-md p-3 mb-3">
                <Text className="text-sky-950 text-sm">
                  Mode test Thirdweb Pay (Transak staging) : carte de test, pas de débit réel. Sur Ethereum
                  mainnet, Transak indique souvent qu’aucun ETH n’est crédité malgré un ordre « réussi » — tu
                  valides surtout le parcours UI + statut intent. Pour tester le swap bundle avec de vrais fonds,
                  utilise l’onglet Wallet sur testnet (Fuji) ou un petit montant mainnet hors test mode.
                </Text>
              </View>
            ) : null}
            <Text className="text-bundle-muted text-sm mb-1">Devise (paiement Transak)</Text>
            <View className="flex-row flex-wrap gap-2 mb-3">
              {ONRAMP_FIAT_OPTIONS.map((o) => (
                <Pressable
                  key={o.code}
                  onPress={() => setFiatCurrency(o.code)}
                  className={`px-3 py-2 rounded-md border ${
                    fiatCurrency === o.code
                      ? "border-bundle-link bg-bundle-card"
                      : "border-bundle-border-subtle bg-bundle-bg"
                  }`}
                >
                  <Text
                    className={
                      fiatCurrency === o.code ? "text-bundle-link font-medium" : "text-bundle-text"
                    }
                  >
                    {o.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text className="text-bundle-muted text-sm mb-1">Montant ({fiatCurrency})</Text>
            <BundlesTextInput
              value={fiatAmountText}
              onChangeText={setFiatAmountText}
              keyboardType="decimal-pad"
            />
            <Text className="text-bundle-muted text-xs mt-1 mb-2">
              Transak applique pays / KYC : le widget peut ajuster le montant final. La devise choisie sert au
              devis thirdweb ; le pays de session suit en général l’IP (sauf variable d’env projet).
            </Text>
            {modeAEstimate.isError ? (
              <Text className="text-red-600 mt-2">Impossible d&apos;obtenir un prix. Réessayer.</Text>
            ) : null}
            {modeAEstimate.data ? (
              <View className="mt-3 gap-1">
                <Text className="text-bundle-text">
                  Est. tokens: {formatBundleAmount(modeAEstimate.data.estTokens, index?.symbol ?? "")}
                </Text>
                <Text className="text-bundle-muted text-sm">
                  ETH requis (est.): {formatEthFromWei(modeAEstimate.data.ethCost)}
                </Text>
                <Text className="text-bundle-muted text-sm">Frais: on-ramp ~1 % + gas variable</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View className="mb-6">
            <View className="mb-3">
              <BundlesSegmented<"buy" | "sell">
                variant="emphasis"
                options={[
                  { value: "buy", label: "Acheter" },
                  { value: "sell", label: "Vendre" },
                ]}
                value={modeBDir}
                onChange={setModeBDir}
              />
            </View>
            <Text className="text-bundle-muted text-sm mb-1">Quantité (tokens bundle)</Text>
            <BundlesTextInput
              value={amountText}
              onChangeText={setAmountText}
              keyboardType="decimal-pad"
            />
            <Text className="text-bundle-muted text-sm mt-2">
              Slippage ({SLIPPAGE_BPS_MIN}–{SLIPPAGE_BPS_MAX} bps, défaut aligné web 0,5&nbsp;%)
            </Text>
            <BundlesTextInput
              value={String(slippageBps)}
              onChangeText={(t) => {
                const raw = Number(t.replace(/[^0-9]/g, ""));
                setSlippageBps(clampSlippageBps(Number.isFinite(raw) ? raw : DEFAULT_SLIPPAGE_BPS));
              }}
              keyboardType="number-pad"
              className="mt-1"
            />
            {modeBQuote.isError ? (
              <Text className="text-red-600 mt-2">Impossible d&apos;obtenir un prix. Réessayer.</Text>
            ) : null}
            {modeBQuote.data && "ethCost" in modeBQuote.data ? (
              <Text className="text-bundle-text mt-2">
                Coût ETH: {formatEthFromWei(modeBQuote.data.ethCost)}
              </Text>
            ) : null}
            {modeBQuote.data && "ethProceeds" in modeBQuote.data ? (
              <Text className="text-bundle-text mt-2">
                ETH reçu: {formatEthFromWei(modeBQuote.data.ethProceeds)}
              </Text>
            ) : null}
          </View>
        )}

        {swapMutation.isError || openOnrampMutation.isError || resumeMutation.isError ? (
          <Text className="text-red-600 mb-2">Action échouée. Réessayer.</Text>
        ) : null}

        <BundlesButton
          variant="primary"
          disabled={Boolean(primaryDisabled)}
          loading={swapMutation.isPending || openOnrampMutation.isPending}
          onPress={() => void onPrimary()}
        >
          {tradeTabMode === "cb" ? "Continuer avec carte" : "Confirmer le swap"}
        </BundlesButton>
      </ScrollView>

      <Modal visible={pickerOpen} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-bundle-bg p-4">
          <Text className="text-lg font-semibold mb-2">Choisir un bundle</Text>
          <ScrollView>
            {bundles.map((b) => (
              <Pressable
                key={b.address}
                onPress={() => {
                  setSelected(b.address);
                  setPickerOpen(false);
                }}
                className="py-3 border-b border-bundle-border"
              >
                <Text className="text-bundle-text">
                  {b.name} ({b.symbol})
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable onPress={() => setPickerOpen(false)} className="mt-4">
            <Text className="text-center text-bundle-muted">Fermer</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}
