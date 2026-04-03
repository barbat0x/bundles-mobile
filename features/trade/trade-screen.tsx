import { buyBundle, quoteBundles, sellBundle } from "@/services/universal-router-client";
import * as WebBrowser from "expo-web-browser";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useActiveAccount } from "thirdweb/react-native";

import { parseUnits, type Address } from "viem";
import { erc20Abi, formatUnits } from "viem";

import { BundlesButton, BundlesTextInput } from "@/components/ui";
import { WalletMenuHeader } from "@/components/wallet-menu-header";
import { TopVioletGradient } from "@/components/top-violet-gradient";
import { getThirdwebChain } from "@/lib/chain-runtime";
import { formatBundleAmount, formatEthFromWei, formatFiatAmount } from "@/lib/format";
import { t } from "@/lib/i18n";
import { bundleIconUrl } from "@/lib/media";
import { uiTokens } from "@/lib/ui-tokens";
import { getChainConfig, isOnRampEnabledChain } from "@/lib/chains";
import { isThirdwebPayTestMode } from "@/lib/env";
import {
  clearPurchaseIntent,
  loadPurchaseIntent,
  savePurchaseIntent,
  type PurchaseIntent,
} from "@/lib/purchase-intent";
import {
  ONRAMP_FIAT_OPTIONS,
  type OnRampFiatCurrencyCode,
  coingeckoVsForFiat,
} from "@/lib/fiat-onramp-currencies";
import { resolveEffectiveFiatCurrency, resolveUserCountryCode } from "@/lib/fiat-country-capabilities";
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
  toSlippageBpsBigint,
} from "@/lib/slippage";
import {
  getModeAGasBufferWei,
  POST_ONRAMP_RESERVE_USD,
  SLIPPAGE_BPS,
  TX_DEADLINE_SECONDS,
} from "@/lib/contracts";
import { cardShadow, pageVioletBg } from "@/lib/ui-shell";
import { useFiatPreferencesStore } from "@/store/fiat-preferences-store";
import type {
  SwapExecutionProgressEvent,
  SwapExecutionStepKey,
  SwapExecutionUiState,
} from "@/features/trade/swap-execution-state";

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

  const { tradeTabMode, setTradeTabMode, slippageBps } = useTradeUiStore();
  const preferredFiatCurrency = useFiatPreferencesStore((s) => s.preferredFiatCurrency);
  const setPreferredFiatCurrency = useFiatPreferencesStore((s) => s.setPreferredFiatCurrency);
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
  const [swapUiState, setSwapUiState] = useState<SwapExecutionUiState>({ status: "idle" });
  const [lastSwapSummary, setLastSwapSummary] = useState<{
    direction: ModeBDirection;
    amountText: string;
    symbol: string;
  } | null>(null);
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
  const userCountryCode = resolveUserCountryCode();
  const fiatResolution = useMemo(
    () =>
      resolveEffectiveFiatCurrency({
        countryCode: userCountryCode,
        userPreference: preferredFiatCurrency,
      }),
    [preferredFiatCurrency, userCountryCode],
  );
  const fiatCurrency: OnRampFiatCurrencyCode = fiatResolution.effectiveFiatCurrency;
  const supportedFiatOptions = useMemo(
    () => ONRAMP_FIAT_OPTIONS.filter((o) => fiatResolution.capabilities.supportedFiatCurrencies.includes(o.code)),
    [fiatResolution.capabilities.supportedFiatCurrencies],
  );
  useEffect(() => {
    if (preferredFiatCurrency !== fiatCurrency) {
      setPreferredFiatCurrency(fiatCurrency);
    }
  }, [fiatCurrency, preferredFiatCurrency, setPreferredFiatCurrency]);
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
  const isModeBQuoteLoading =
    tradeTabMode === "swap" &&
    amountWei > 0n &&
    (modeBQuote.isLoading || modeBQuote.isFetching);
  const ethToFiatRateQuery = useQuery({
    queryKey: ["prices", "eth-to-fiat", fiatCurrency],
    queryFn: () => fetchEthPriceInFiat(coingeckoVsForFiat(fiatCurrency)),
    staleTime: 60_000,
  });

  const selectedBundleBalanceWeiQuery = useQuery({
    enabled: Boolean(account?.address && selected && tradeTabMode === "swap" && modeBDir === "sell"),
    queryKey: ["modeB", "bundle-balance", activeChainId, selected, account?.address ?? "0x"],
    queryFn: async () => {
      if (!account?.address || !selected) return 0n;
      return publicClient.readContract({
        address: selected as Address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [account.address as Address],
      });
    },
    refetchInterval: 15_000,
    staleTime: 5000,
  });

  const selectedBundleBalanceHuman = useMemo(() => {
    const balanceWei = selectedBundleBalanceWeiQuery.data;
    if (!balanceWei || !index) return "0";
    return formatUnits(balanceWei, index.decimals);
  }, [index, selectedBundleBalanceWeiQuery.data]);

  const onSetMaxSellAmount = useCallback(() => {
    if (!selectedBundleBalanceHuman || Number(selectedBundleBalanceHuman) <= 0) return;
    setAmountText(selectedBundleBalanceHuman);
  }, [selectedBundleBalanceHuman]);

  const explorerTxBaseUrl = getChainConfig(activeChainId).explorerTxBaseUrl;
  const expectedEthText = useMemo(() => {
    if (tradeTabMode !== "swap") return "—";
    if (modeBDir === "buy") {
      return modeBQuote.data && "ethCost" in modeBQuote.data ? formatEthFromWei(modeBQuote.data.ethCost) : "—";
    }
    return modeBQuote.data && "ethProceeds" in modeBQuote.data
      ? formatEthFromWei(modeBQuote.data.ethProceeds)
      : "—";
  }, [modeBDir, modeBQuote.data, tradeTabMode]);
  const expectedEthWei = useMemo(() => {
    if (tradeTabMode !== "swap" || !modeBQuote.data) return undefined;
    if (modeBDir === "buy" && "ethCost" in modeBQuote.data) return modeBQuote.data.ethCost;
    if (modeBDir === "sell" && "ethProceeds" in modeBQuote.data) return modeBQuote.data.ethProceeds;
    return undefined;
  }, [modeBDir, modeBQuote.data, tradeTabMode]);
  const expectedFiatText = useMemo(() => {
    if (!expectedEthWei) return null;
    const ethToFiatRate = ethToFiatRateQuery.data ?? 0;
    if (!Number.isFinite(ethToFiatRate) || ethToFiatRate <= 0) return null;
    const ethAmount = Number.parseFloat(formatUnits(expectedEthWei, 18));
    if (!Number.isFinite(ethAmount) || ethAmount <= 0) return null;
    return formatFiatAmount(ethAmount * ethToFiatRate, fiatCurrency);
  }, [ethToFiatRateQuery.data, expectedEthWei, fiatCurrency]);

  const updateSwapProgress = useCallback((direction: ModeBDirection, event: SwapExecutionProgressEvent) => {
    setSwapUiState((current) => {
      const baseSteps = current.status === "in_progress" ? current.steps : [];
      const deduped = [...baseSteps.filter((s) => s.step !== event.step), event];
      const txHash = event.txHash ?? (current.status === "in_progress" ? current.txHash : undefined);
      return {
        status: "in_progress",
        direction,
        steps: deduped,
        txHash,
      };
    });
  }, []);

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
    mutationFn: async (args?: { onProgress?: (event: SwapExecutionProgressEvent) => void }) => {
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
          onProgress: args?.onProgress,
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
        onProgress: args?.onProgress,
      });
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
    swapUiState.status === "in_progress" ||
    bundlesQ.isLoading ||
    !index ||
    (tradeTabMode === "swap" &&
      (amountWei <= 0n || modeBQuote.isLoading || modeBQuote.isError || swapMutation.isPending)) ||
    (tradeTabMode === "cb" &&
      (!onRampEnabled || modeAEstimate.isLoading || modeAEstimate.isError || openOnrampMutation.isPending));

  const onPrimary = useCallback(async () => {
    if (tradeTabMode === "swap") {
      setSwapUiState({ status: "preconfirm" });
      return;
    }
    if (!onRampEnabled) {
      throw new Error(t("trade.errors.onRampUnavailable"));
    }
    await openOnrampMutation.mutateAsync();
  }, [onRampEnabled, openOnrampMutation, tradeTabMode]);

  const stepOrderByDirection: Record<ModeBDirection, SwapExecutionStepKey[]> = {
    buy: ["swap_pending", "swap_submitted", "swap_confirmed"],
    sell: [
      "approval_check",
      "approval_pending",
      "approval_confirmed",
      "swap_pending",
      "swap_submitted",
      "swap_confirmed",
    ],
  };

  const stepLabel = useCallback((step: SwapExecutionStepKey): string => {
    switch (step) {
      case "approval_check":
        return t("trade.tx.stepApprovalCheck");
      case "approval_pending":
        return t("trade.tx.stepApprovalPending");
      case "approval_confirmed":
        return t("trade.tx.stepApprovalConfirmed");
      case "swap_pending":
        return t("trade.tx.stepSwapPending");
      case "swap_submitted":
        return t("trade.tx.stepSwapSubmitted");
      case "swap_confirmed":
        return t("trade.tx.stepSwapConfirmed");
      default:
        return step;
    }
  }, []);

  const runSwapExecution = useCallback(async () => {
    const direction = modeBDir;
    const executedAmountText = amountText || "0";
    const executedSymbol = index?.symbol ?? "";
    setSwapUiState({ status: "in_progress", direction, steps: [] });
    try {
      const result = await swapMutation.mutateAsync({
        onProgress: (event) => updateSwapProgress(direction, event),
      });
      setSwapUiState({ status: "success", direction, txHash: result.transactionHash });
      setLastSwapSummary({
        direction,
        amountText: executedAmountText,
        symbol: executedSymbol,
      });
      await queryClient.invalidateQueries();
      setAmountText("");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("trade.tx.swapFailedFallback");
      setSwapUiState((current) => ({
        status: "failed",
        direction,
        steps: current.status === "in_progress" ? current.steps : [],
        txHash: current.status === "in_progress" ? current.txHash : undefined,
        errorMessage: message,
      }));
    }
  }, [amountText, index?.symbol, modeBDir, queryClient, swapMutation, updateSwapProgress]);

  const openExplorer = useCallback(
    async (txHash: string) => {
      await Linking.openURL(`${explorerTxBaseUrl}${txHash}`);
    },
    [explorerTxBaseUrl],
  );

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
  const sourceOfFundsHelpText = tradeTabMode === "cb" ? t("trade.sourceOfFundsHelpCard") : t("trade.sourceOfFundsHelpWallet");

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
              {renderFundsSourceTab("cb", t("trade.cardRecommended"), "card-outline")}
              <View className="h-full w-[2px] bg-white" />
              {renderFundsSourceTab("swap", t("trade.walletEth"), "wallet-outline")}
            </View>
            <Text className="text-bundle-muted text-xs mt-2">{sourceOfFundsHelpText}</Text>
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
              {supportedFiatOptions.map((o) => (
                <Pressable
                  key={o.code}
                  onPress={() => setPreferredFiatCurrency(o.code)}
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
            {fiatResolution.didFallback ? (
              <Text className="text-amber-700 text-xs mb-2">
                {t("trade.currencyAutoAdjusted")
                  .replace("{country}", fiatResolution.capabilities.countryCode)
                  .replace("{currency}", fiatCurrency)}
              </Text>
            ) : null}
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
              <Text className="text-bundle-muted text-sm mb-1">
                {modeBDir === "buy" ? t("trade.amountToReceive") : t("trade.amountToSell")}
              </Text>
            <View className="relative">
              <BundlesTextInput
                value={amountText}
                onChangeText={setAmountText}
                keyboardType="decimal-pad"
                className="pr-[150px]"
              />
              <View className="absolute right-3 top-0 bottom-0 flex-row items-center gap-2">
                {modeBDir === "sell" ? (
                  <Pressable onPress={onSetMaxSellAmount} className="px-2 py-1 rounded-[8px] bg-[#F1E6F2] active:opacity-80">
                    <Text className="text-[#8A0294] text-[12px]" style={{ fontFamily: uiTokens.fontFamily.sansSemibold }}>
                      MAX
                    </Text>
                  </Pressable>
                ) : null}
                {index ? (
                  <View className="flex-row items-center gap-1">
                    <Image
                      source={{ uri: bundleIconUrl(index.address, activeChainId) }}
                      style={{ width: 18, height: 18, borderRadius: 9 }}
                    />
                    <Text className="text-[12px] text-[#6B6C73]" style={{ fontFamily: uiTokens.fontFamily.sansMedium }}>
                      {index.symbol}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
            {modeBDir === "sell" ? (
              <Pressable onPress={onSetMaxSellAmount} className="self-end mt-1 active:opacity-80">
                <Text className="text-[12px] text-[#8A0294]" style={{ fontFamily: uiTokens.fontFamily.sansMedium }}>
                  {selectedBundleBalanceHuman} {index?.symbol ?? ""}
                </Text>
              </Pressable>
            ) : null}
            {modeBDir === "sell" && expectedFiatText ? (
              <Text className="text-bundle-muted text-xs mt-1">~ {expectedFiatText}</Text>
            ) : null}
            {isModeBQuoteLoading ? (
              <View className="mt-2 flex-row items-center gap-2">
                <ActivityIndicator size="small" color={uiTokens.colors.ctaPrimary} />
                <Text className="text-bundle-muted text-sm">{t("trade.loadingQuote")}</Text>
              </View>
            ) : null}
            {modeBQuote.isError ? (
                <Text className="text-red-600 mt-2">{t("trade.unablePrice")}</Text>
            ) : null}
            {modeBQuote.data ? (
              <View className="mt-3 rounded-[14px] bg-[#F7F8FA] border border-[#E5E5E5] p-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-bundle-muted text-sm">{modeBDir === "buy" ? t("trade.youPay") : t("trade.youSell")}</Text>
                  <Text className="text-[#181818] text-[15px]" style={{ fontFamily: uiTokens.fontFamily.sansSemibold }}>
                    {amountText || "0"} {index?.symbol ?? ""}
                  </Text>
                </View>
                <View className="mt-2 flex-row items-center justify-between">
                  <Text className="text-bundle-muted text-sm">{modeBDir === "buy" ? t("trade.ethCost") : t("trade.totalValue")}</Text>
                  <Text className="text-[#181818] text-[16px]" style={{ fontFamily: uiTokens.fontFamily.sansSemibold }}>
                    {"ethCost" in modeBQuote.data
                      ? formatEthFromWei(modeBQuote.data.ethCost)
                      : formatEthFromWei(modeBQuote.data.ethProceeds)}
                    {expectedFiatText ? ` (~ ${expectedFiatText})` : ""}
                  </Text>
                </View>
                <Text className="text-bundle-muted text-xs mt-2">{t("trade.ethHelp")}</Text>
              </View>
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

      <Modal
        visible={swapUiState.status === "preconfirm"}
        transparent
        animationType="fade"
        onRequestClose={() => setSwapUiState({ status: "idle" })}
      >
        <View className="flex-1 bg-black/35 items-center justify-center px-5">
          <View className="w-full rounded-[20px] bg-white p-4" style={cardShadow}>
            <Text className="text-[20px] leading-[24px] font-semibold text-[#181818] mb-3">
              {t("trade.tx.reviewTitle")}
            </Text>
            <View className="flex-row items-center gap-2 mb-3">
              {index ? (
                <Image
                  source={{ uri: bundleIconUrl(index.address, activeChainId) }}
                  style={{ width: 22, height: 22, borderRadius: 11 }}
                />
              ) : null}
              <Text className="text-[#181818] text-[16px]" style={{ fontFamily: uiTokens.fontFamily.sansMedium }}>
                {modeBDir === "buy" ? t("trade.buy") : t("trade.sell")} {index?.symbol ?? ""}
              </Text>
            </View>
            <Text className="text-bundle-muted text-sm">{t("trade.tx.bundleAmount")}</Text>
            <Text className="text-[#181818] mb-2">{amountText || "0"} {index?.symbol ?? ""}</Text>
            {expectedFiatText ? (
              <Text className="text-bundle-muted text-xs mb-2">~ {expectedFiatText}</Text>
            ) : null}
            <Text className="text-bundle-muted text-sm">{t("trade.tx.youPay")}</Text>
            <Text className="text-[#181818] mb-2">
              {modeBDir === "buy"
                ? expectedFiatText ?? "—"
                : `${amountText || "0"} ${index?.symbol ?? ""}`}
            </Text>
            <Text className="text-bundle-muted text-sm">{t("trade.tx.youReceive")}</Text>
            <Text className="text-[#181818] mb-2">
              {modeBDir === "buy"
                ? `${amountText || "0"} ${index?.symbol ?? ""}`
                : expectedFiatText ?? expectedEthText}
            </Text>
            <Text className="text-bundle-muted text-sm">
              {modeBDir === "buy" ? t("trade.ethCost") : t("trade.totalValue")}
            </Text>
            <Text className="text-[#181818] mb-2">
              {expectedEthText}
              {expectedFiatText ? ` (~ ${expectedFiatText})` : ""}
            </Text>
            <Text className="text-bundle-muted text-xs mb-2">{t("trade.ethHelp")}</Text>
            <Text className="text-bundle-muted text-sm">{t("trade.tx.slippagePolicy")}</Text>
            <Text className="text-[#181818] mb-2">{t("trade.tx.defaultProtectedSlippage")}</Text>
            <Text className="text-bundle-muted text-sm">{t("trade.tx.network")}</Text>
            <Text className="text-[#181818] mb-4">{getChainConfig(activeChainId).name}</Text>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => setSwapUiState({ status: "idle" })}
                className="flex-1 h-12 rounded-[14px] border border-[#E5E5E5] bg-[#F7F8FA] items-center justify-center active:opacity-80"
              >
                <Text className="text-[#181818]">{t("trade.tx.cancel")}</Text>
              </Pressable>
              <Pressable
                onPress={() => void runSwapExecution()}
                className="flex-1 h-12 rounded-[14px] bg-[#8A0294] items-center justify-center active:opacity-80"
              >
                <Text className="text-white" style={{ fontFamily: uiTokens.fontFamily.sansSemibold }}>
                  {t("trade.tx.confirmAndContinue")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={swapUiState.status === "in_progress" || swapUiState.status === "success" || swapUiState.status === "failed"}
        transparent
        animationType="fade"
      >
        <View className="flex-1 bg-black/35 items-center justify-center px-5">
          <View className="w-full rounded-[20px] bg-white p-4" style={cardShadow}>
            <Text className="text-[20px] leading-[24px] font-semibold text-[#181818] mb-3">
              {swapUiState.status === "success"
                ? t("trade.tx.swapCompleted")
                : swapUiState.status === "failed"
                  ? t("trade.tx.swapFailed")
                  : t("trade.tx.swapInProgress")}
            </Text>

            {swapUiState.status === "in_progress" || swapUiState.status === "failed" ? (
              <View className="mb-3">
                {stepOrderByDirection[swapUiState.direction].map((step) => {
                  const rawEvent = swapUiState.steps.find((s) => s.step === step);
                  const approvalPendingSeen = swapUiState.steps.some((s) => s.step === "approval_pending");
                  const swapSubmittedDone = swapUiState.steps.some(
                    (s) => s.step === "swap_submitted" && s.status === "done",
                  );
                  const event =
                    step === "swap_pending" &&
                    (
                      (swapUiState.direction === "sell" && !approvalPendingSeen) ||
                      swapUiState.direction === "buy"
                    ) &&
                    swapSubmittedDone &&
                    rawEvent?.status === "pending"
                      ? { ...rawEvent, status: "done" as const }
                      : rawEvent;
                  const color =
                    event?.status === "done"
                      ? "#16A34A"
                      : event?.status === "failed"
                        ? "#DC2626"
                        : "#919299";
                  return (
                    <View key={step} className="flex-row items-center justify-between py-1">
                      <Text className="text-[14px]" style={{ color }}>
                        {stepLabel(step)}
                      </Text>
                      <Text className="text-[12px]" style={{ color }}>
                        {event?.status === "done"
                          ? t("trade.tx.done")
                          : event?.status === "failed"
                            ? t("trade.tx.failed")
                            : t("trade.tx.pending")}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {swapUiState.status === "failed" ? (
              <Text className="text-red-600 mb-3">{swapUiState.errorMessage}</Text>
            ) : null}

            {swapUiState.status === "failed" && swapUiState.txHash ? (
              <Pressable onPress={() => void openExplorer(swapUiState.txHash as string)} className="mb-3 active:opacity-80">
                <Text className="text-[#8A0294] text-[14px]">
                  {t("trade.tx.viewOnExplorer")} {swapUiState.txHash.slice(0, 10)}...
                </Text>
              </Pressable>
            ) : null}

            {swapUiState.status === "in_progress" ? (
              <ActivityIndicator color={uiTokens.colors.ctaPrimary} />
            ) : null}

            {swapUiState.status === "success" ? (
              <View className="mb-2">
                <View className="items-center mb-3">
                  <Ionicons name="checkmark-circle" size={56} color="#8A0294" />
                </View>
                <Text
                  className="text-[#181818] text-[16px] text-center mb-1"
                  style={{ fontFamily: uiTokens.fontFamily.sansSemibold }}
                >
                  {lastSwapSummary?.direction === "buy" ? t("trade.tx.buyCompleted") : t("trade.tx.sellCompleted")}
                </Text>
                <Text className="text-bundle-muted text-[14px] text-center mb-4">
                  {lastSwapSummary?.direction === "buy" ? t("trade.tx.received") : t("trade.tx.sold")}{" "}
                  {lastSwapSummary?.amountText ?? "0"} {lastSwapSummary?.symbol ?? ""}
                </Text>
                <Pressable
                  onPress={() => setSwapUiState({ status: "idle" })}
                  className="h-12 rounded-[14px] bg-[#8A0294] items-center justify-center active:opacity-80"
                >
                  <Text className="text-white" style={{ fontFamily: uiTokens.fontFamily.sansSemibold }}>
                    {t("common.close")}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {swapUiState.status === "failed" ? (
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => setSwapUiState({ status: "idle" })}
                  className="flex-1 h-12 rounded-[14px] border border-[#E5E5E5] bg-[#F7F8FA] items-center justify-center active:opacity-80"
                >
                  <Text className="text-[#181818]">{t("common.close")}</Text>
                </Pressable>
                <Pressable
                  onPress={() => void runSwapExecution()}
                  className="flex-1 h-12 rounded-[14px] bg-[#8A0294] items-center justify-center active:opacity-80"
                >
                  <Text className="text-white" style={{ fontFamily: uiTokens.fontFamily.sansSemibold }}>
                    {t("common.retry")}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

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

