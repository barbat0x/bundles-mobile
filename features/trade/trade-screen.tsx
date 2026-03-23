import { buyBundle, quoteBundles, sellBundle } from "@/services/universal-router-client";
import * as WebBrowser from "expo-web-browser";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useActiveAccount } from "thirdweb/react-native";

import { parseUnits, type Address } from "viem";

import { BundlesButton, BundlesTextInput } from "@/components/ui";
import { WalletMenuHeader } from "@/components/wallet-menu-header";
import { TopVioletGradient } from "@/components/top-violet-gradient";
import { getThirdwebChain } from "@/lib/chain-runtime";
import { formatEthFromWei, formatBundleAmount } from "@/lib/format";
import { t } from "@/lib/i18n";
import { bundleIconUrl } from "@/lib/media";
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
import {
  getModeAGasBufferWei,
  POST_ONRAMP_RESERVE_USD,
  SLIPPAGE_BPS,
  TX_DEADLINE_SECONDS,
} from "@/lib/contracts";
import { cardShadow, pageVioletBg } from "@/lib/ui-shell";

type ModeBDirection = "buy" | "sell";
type TradeFundsSource = "cb" | "swap";

function randomId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function TradeScreen() {
  const params = useLocalSearchParams<{ bundle?: string }>();
  const account = useActiveAccount();
  const activeChainId = useNetworkStore((s) => s.activeChainId);
  const queryClient = useQueryClient();
  const twChain = getThirdwebChain(activeChainId);
  const onRampEnabled = isOnRampEnabledChain(activeChainId);
  const thirdwebPayTestMode = isThirdwebPayTestMode();
  const client = getThirdwebBrowserClient();
  const publicClient = getViemPublicClient(activeChainId);

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
      if (!selected || !Number.isFinite(fiatNum)) throw new Error(t("trade.errors.invalidInput"));
      let ethWei: bigint | null = null;

      if (account?.address) {
        try {
          const onRampQuote = await quoteFiatToEthOnramp({
            client,
            chainId: activeChainId,
            walletAddress: account.address,
            fiatAmount: debouncedFiatAmount,
            fiatCurrency,
          });
          ethWei = BigInt(onRampQuote.onRampToken.amountWei);
        } catch {
          // Non-blocking fallback to public price estimation.
        }
      }

      if (ethWei === null) {
        const ethInFiat = await fetchEthPriceInFiat(coingeckoVsForFiat(fiatCurrency));
        const ethFloat = fiatNum / ethInFiat;
        ethWei = BigInt(Math.floor(ethFloat * 1e18));
      }

      const [bundleQuote] = await quoteBundles(publicClient, [selected as Address]);
      const weiPerToken = bundleQuote.singleTokenValueETH;
      const estTokens = weiPerToken > 0n ? Number(ethWei) / Number(weiPerToken) : 0;
      const desiredHuman = estTokens;
      const desiredWei =
        desiredHuman > 0
          ? parseUnits(desiredHuman.toFixed(Math.min(decimals, 8)), decimals)
          : 0n;
      let ethCost = 0n;
      if (desiredWei > 0n) {
        const buyQuote = await buyBundle(publicClient, selected as Address, desiredWei, {
          deadline: BigInt(TX_DEADLINE_SECONDS),
        });
        ethCost = buyQuote.ethCost;
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
      if (!selected) throw new Error(t("trade.errors.noBundleSelected"));
      if (modeBDir === "buy") {
        return buyBundle(publicClient, selected as Address, amountWei, {
          deadline: BigInt(TX_DEADLINE_SECONDS),
        });
      }
      return sellBundle(publicClient, selected as Address, amountWei, {
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
      const intentStatus = await fetchBuyWithFiatIntentStatus({
        client,
        intentId: pendingIntent.onRampIntentId,
      });
      return intentStatus.status;
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
      const walletBalanceWei = await publicClient.getBalance({
        address: account.address as Address,
      });
      const bps = toSlippageBpsBigint(BigInt(clampSlippageBps(slippageBps)), SLIPPAGE_BPS);
      const gasBuffer = getModeAGasBufferWei(activeChainId);

      let spendReserveWei = 0n;
      if (activeChainId === 1) {
        try {
          const ethUsdPrice = await fetchEthUsdCoingeckoCached();
          spendReserveWei = ethWeiFromUsdReserve(POST_ONRAMP_RESERVE_USD, ethUsdPrice);
        } catch {
          spendReserveWei = 10n ** 15n;
        }
      }

      return computeModeAFundsState({
        publicClient,
        bundleAddress: pendingIntent.bundleAddress as Address,
        targetBundleOutWei: BigInt(pendingIntent.desiredBundleAmount),
        slippageBps: bps,
        balanceWei: walletBalanceWei,
        gasBufferWei: gasBuffer,
        spendReserveWei,
      });
    },
    refetchInterval: 5000,
    staleTime: 0,
  });

  const swapMutation = useMutation({
    mutationFn: async () => {
      if (!account || !selected) throw new Error(t("trade.errors.walletAndBundleRequired"));
      if (!isBundleAddressAllowed(selected as Address, bundles)) {
        throw new Error(t("trade.errors.bundleNotAllowed"));
      }
      const slippageBpsBigint = BigInt(clampSlippageBps(slippageBps));
      if (amountWei <= 0n) throw new Error(t("trade.errors.amountRequired"));
      if (modeBDir === "buy") {
        return executeBuy({
          publicClient,
          twClient: client,
          twChain,
          chainId: activeChainId,
          account,
          bundleAddress: selected as Address,
          desiredBundleAmount: amountWei,
          slippageBps: slippageBpsBigint,
        });
      }
      return executeSell({
        publicClient,
        twClient: client,
        twChain,
        chainId: activeChainId,
        account,
        bundleAddress: selected as Address,
        bundleAmountIn: amountWei,
        slippageBps: slippageBpsBigint,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      setAmountText("");
    },
  });

  const openOnrampMutation = useMutation({
    mutationFn: async () => {
      if (!account?.address) throw new Error(t("trade.errors.connectWallet"));
      if (!selected || !modeAEstimate.data?.desiredWei) throw new Error(t("trade.errors.quoteRequired"));
      const onRampQuote = await quoteFiatToEthOnramp({
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
        onRampIntentId: onRampQuote.intentId,
        status: "payment_pending",
        createdAt: Date.now(),
      };
      await savePurchaseIntent(intent);
      setPendingIntent(intent);
      await WebBrowser.openBrowserAsync(onRampQuote.onRampLink);
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      const intent = pendingIntent ?? (await loadPurchaseIntent());
      if (!intent || !account) throw new Error(t("trade.errors.noPendingPurchase"));
      if (intent.chainId !== activeChainId) {
        throw new Error(t("trade.errors.intentWrongNetwork"));
      }
      await savePurchaseIntent({ ...intent, status: "swapping" });
      setPendingIntent({ ...intent, status: "swapping" });
      const list = await queryClient.ensureQueryData({
        ...queryConfig.bundlesList(activeChainId),
        queryFn: () => fetchBundleIndexesList(activeChainId),
      });
      if (!isBundleAddressAllowed(intent.bundleAddress, list)) {
        throw new Error(t("trade.errors.bundleNotAllowed"));
      }

      const walletBalanceWei = await publicClient.getBalance({ address: account.address as Address });
      const bps = toSlippageBpsBigint(BigInt(clampSlippageBps(slippageBps)), SLIPPAGE_BPS);
      const gasBuffer = getModeAGasBufferWei(activeChainId);
      let spendReserveWei = 0n;
      if (activeChainId === 1) {
        try {
          const ethUsdPrice = await fetchEthUsdCoingeckoCached();
          spendReserveWei = ethWeiFromUsdReserve(POST_ONRAMP_RESERVE_USD, ethUsdPrice);
        } catch {
          spendReserveWei = 10n ** 15n;
        }
      }
      const { ready, bundleOutWei } = await computeModeAFundsState({
        publicClient,
        bundleAddress: intent.bundleAddress as Address,
        targetBundleOutWei: BigInt(intent.desiredBundleAmount),
        slippageBps: bps,
        balanceWei: walletBalanceWei,
        gasBufferWei: gasBuffer,
        spendReserveWei,
      });
      if (!ready || bundleOutWei <= 0n) {
        throw new Error(t("trade.errors.insufficientBalance"));
      }

      await executeBuy({
        publicClient,
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
      await queryClient.invalidateQueries();
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
      throw new Error(t("trade.errors.onRampUnavailable"));
    }
    await openOnrampMutation.mutateAsync();
  }, [onRampEnabled, openOnrampMutation, swapMutation, tradeTabMode]);

  const renderFundsSourceTab = useCallback(
    (
      value: TradeFundsSource,
      label: string,
      iconName: keyof typeof Ionicons.glyphMap,
    ) => {
      const selected = tradeTabMode === value;
      return (
        <Pressable
          key={value}
          onPress={() => {
            if (value === "cb" && !onRampEnabled) return;
            setTradeTabMode(value);
          }}
          className={`h-full flex-1 flex-row items-center justify-center gap-2 ${selected ? "bg-[#8A0294]" : "bg-white"}`}
        >
          <Ionicons name={iconName} size={18} color={selected ? "#FFFFFF" : "#8A0294"} />
          <Text
            className={`text-[18px] ${selected ? "text-white" : "text-[#8A0294]"}`}
            style={{ fontFamily: selected ? uiTokens.fontFamily.sansSemibold : uiTokens.fontFamily.sansMedium }}
          >
            {label}
          </Text>
        </Pressable>
      );
    },
    [onRampEnabled, setTradeTabMode, tradeTabMode],
  );

  const renderTradeDirectionTab = useCallback(
    (value: ModeBDirection, label: string) => {
      const selected = modeBDir === value;
      return (
        <Pressable
          key={value}
          onPress={() => setModeBDir(value)}
          className={`h-10 flex-1 rounded-[12px] items-center justify-center ${selected ? "bg-[#8A0294]" : "bg-transparent"}`}
        >
          <Text
            className={`text-[15px] ${selected ? "text-white" : "text-[#919299]"}`}
            style={{ fontFamily: selected ? uiTokens.fontFamily.sansMedium : uiTokens.fontFamily.sans }}
          >
            {label}
          </Text>
        </Pressable>
      );
    },
    [modeBDir],
  );

  return (
    <View className="flex-1" style={{ backgroundColor: pageVioletBg }}>
      <View className="absolute top-0 left-0 right-0">
        <TopVioletGradient gradientId="tradeTopVioletFade" />
      </View>
      <View className="px-[14px] pt-[52px]">
        <WalletMenuHeader />
      </View>
      <ScrollView contentContainerClassName="px-[14px] pb-32" keyboardShouldPersistTaps="handled">
        {pendingIntent ? (
          <View className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4">
            <Text className="text-amber-900 mb-2">
              {pendingIntent.status === "swapping"
                ? t("trade.pendingSwap")
                : pendingIntent.status === "payment_pending"
                  ? t("trade.pendingPayment")
                  : pendingIntent.status === "payment_failed"
                    ? t("trade.paymentFailed")
                    : pendingIntent.status === "swap_failed"
                      ? t("trade.swapFailed")
                      : t("trade.fundsReceived")}
            </Text>
            {resumeMutation.isPending ? <ActivityIndicator color={uiTokens.colors.ctaPrimary} /> : null}
          </View>
        ) : null}

        <View className="rounded-[20px] bg-white p-4 mb-4" style={cardShadow}>
          <View className="mb-4">
            <Text className="text-bundle-muted text-sm mb-2">{t("trade.sourceOfFunds")}</Text>
            <View className="h-16 rounded-[20px] bg-white flex-row items-center overflow-hidden border border-[#E5E5E5]">
              {renderFundsSourceTab("cb", t("trade.card"), "card-outline")}
              <View className="h-full w-[2px] bg-white" />
              {renderFundsSourceTab("swap", t("trade.wallet"), "wallet-outline")}
            </View>
          </View>

          <Text className="text-bundle-muted text-sm mb-1">{t("trade.bundleLabel")}</Text>
          <Pressable
            onPress={() => setPickerOpen(true)}
            className="border border-[#E5E5E5] bg-[#F7F8FA] rounded-[12px] p-3 mb-4"
          >
            <Text className="text-bundle-text">
              {index ? `${index.name} (${index.symbol})` : t("trade.selectBundle")}
            </Text>
          </Pressable>

        {tradeTabMode === "cb" ? (
          <View className="mb-6">
            {!onRampEnabled ? (
              <Text className="text-red-600 mb-2">
                  {t("trade.cardModeEthereumOnly")}
              </Text>
            ) : null}
            {onRampEnabled && thirdwebPayTestMode ? (
              <View className="bg-sky-50 border border-sky-200 rounded-md p-3 mb-3">
                  <Text className="text-sky-950 text-sm">{t("trade.transakTestMode")}</Text>
              </View>
            ) : null}
              <Text className="text-bundle-muted text-sm mb-1">{t("trade.transakCurrency")}</Text>
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
              <Text className="text-bundle-muted text-sm mb-1">
                {t("trade.amount")} ({fiatCurrency})
              </Text>
            <BundlesTextInput
              value={fiatAmountText}
              onChangeText={setFiatAmountText}
              keyboardType="decimal-pad"
            />
              <Text className="text-bundle-muted text-xs mt-1 mb-2">{t("trade.transakKycHint")}</Text>
            {modeAEstimate.isError ? (
                <Text className="text-red-600 mt-2">{t("trade.unablePrice")}</Text>
            ) : null}
            {modeAEstimate.data ? (
              <View className="mt-3 gap-1">
                <Text className="text-bundle-text">
                    {t("trade.estimatedTokens")}: {formatBundleAmount(modeAEstimate.data.estTokens, index?.symbol ?? "")}
                </Text>
                <Text className="text-bundle-muted text-sm">
                    {t("trade.estimatedEthRequired")}: {formatEthFromWei(modeAEstimate.data.ethCost)}
                </Text>
                  <Text className="text-bundle-muted text-sm">{t("trade.feesHint")}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View className="mb-6">
            <View className="mb-3">
              <View className="h-12 rounded-[14px] bg-[#F4F5F7] p-1 flex-row items-center">
                {renderTradeDirectionTab("buy", t("trade.buy"))}
                {renderTradeDirectionTab("sell", t("trade.sell"))}
              </View>
            </View>
              <Text className="text-bundle-muted text-sm mb-1">{t("trade.quantityBundleTokens")}</Text>
            <BundlesTextInput
              value={amountText}
              onChangeText={setAmountText}
              keyboardType="decimal-pad"
            />
            <Text className="text-bundle-muted text-sm mt-2">
                {t("trade.slippage")} ({SLIPPAGE_BPS_MIN}–{SLIPPAGE_BPS_MAX} {t("trade.slippageHintSuffix")})
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
                <Text className="text-red-600 mt-2">{t("trade.unablePrice")}</Text>
            ) : null}
            {modeBQuote.data && "ethCost" in modeBQuote.data ? (
              <Text className="text-bundle-text mt-2">
                  {t("trade.ethCost")}: {formatEthFromWei(modeBQuote.data.ethCost)}
              </Text>
            ) : null}
            {modeBQuote.data && "ethProceeds" in modeBQuote.data ? (
              <Text className="text-bundle-text mt-2">
                  {t("trade.ethReceived")}: {formatEthFromWei(modeBQuote.data.ethProceeds)}
              </Text>
            ) : null}
          </View>
        )}

        {swapMutation.isError || openOnrampMutation.isError || resumeMutation.isError ? (
            <Text className="text-red-600 mb-2">{t("trade.actionFailed")}</Text>
        ) : null}

          <BundlesButton
            variant="primary"
            disabled={Boolean(primaryDisabled)}
            loading={swapMutation.isPending || openOnrampMutation.isPending}
            className="h-16 rounded-[20px] border-0"
            style={{
              backgroundColor: primaryDisabled ? "#AA03B6" : "#8A0294",
              opacity: 1,
            }}
            onPress={() => void onPrimary()}
          >
            {tradeTabMode === "cb" ? t("trade.continueWithCard") : t("trade.confirmSwap")}
          </BundlesButton>
        </View>
      </ScrollView>

      <Modal visible={pickerOpen} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1" style={{ backgroundColor: pageVioletBg }}>
          <View className="absolute top-0 left-0 right-0">
            <TopVioletGradient gradientId="tradePickerTopVioletFade" height={300} viewBoxHeight={300} />
          </View>

          <View className="flex-1 px-[14px] pt-[52px] pb-6">
            <View className="rounded-[20px] bg-white p-4 mb-4" style={cardShadow}>
              <Text className="text-[20px] leading-[24px] font-semibold text-[#181818] mb-2">
                {t("trade.chooseBundle")}
              </Text>
              <ScrollView>
                {bundles.map((b) => (
                  <Pressable
                    key={b.address}
                    onPress={() => {
                      setSelected(b.address);
                      setPickerOpen(false);
                    }}
                    className="py-3 border-b border-[#E5E5E5] flex-row items-center active:opacity-80"
                  >
                    <Image
                      source={{ uri: bundleIconUrl(b.address, activeChainId) }}
                      style={{ width: 40, height: 40, borderRadius: 20 }}
                    />
                    <View className="ml-[10px] flex-1">
                      <Text className="text-[16px] leading-[19px] font-medium text-[#181818]">
                        {b.name}
                      </Text>
                      <Text className="text-[14px] text-[#A9AAB2]">{b.symbol}</Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <Pressable onPress={() => setPickerOpen(false)} className="h-12 rounded-[14px] bg-white items-center justify-center" style={cardShadow}>
              <Text className="text-[16px] font-medium text-[#8A0294]">{t("common.close")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

