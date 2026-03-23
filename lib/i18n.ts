import { getLocales } from "expo-localization";
import { I18n } from "i18n-js";

const translations = {
  en: {
    common: {
      close: "Close",
      retry: "Retry",
      wallet: "Wallet",
      disconnected: "Not connected",
      copy: "Copy",
      version: "Version",
    },
    settings: {
      title: "Settings",
      address: "Address",
      exportPrivateKey: "Export private key",
      exportPrivateKeyHint: "Protected by biometrics - see instructions",
      signOut: "Sign out",
      authPrompt: "Confirm your identity",
      exportAlertTitle: "Export key",
      exportAlertMessage:
        "Use the thirdweb account button below. Private key export options are handled in the integrated wallet flow after connection.",
    },
    bundleDetail: {
      notFound: "Bundle not found.",
      metrics: "Metrics",
      underlyings: "Underlyings",
      trade: "Trade",
      marketCap: "Market cap",
      mintBurnFee: "Mint/burn fee",
      swapFee: "Swap fee",
      holders: "Holders",
    },
    bundlesList: {
      loadingBundles: "Loading bundles...",
      unableToLoadBundles: "Unable to load bundles.",
      noInternetConnection: "No internet connection",
      noBundlesAvailable: "No bundles available.",
      bundlesList: "Bundles list",
      last24h: "Last 24h",
      featured: "Featured",
      marketCap: "Market cap",
      priceChange: "Price change",
    },
    portfolio: {
      connectToView: "Connect to view your portfolio.",
      offlineSyncWarning: "Last sync may be stale (offline)",
      myTokens: "My Tokens",
      noTokensYet: "No tokens yet.",
      discoverBundles: "Discover bundles",
      buy: "Buy",
      swap: "Swap",
      send: "Send",
      portfolio: "Portfolio",
    },
    trade: {
      sourceOfFunds: "Source of funds",
      bundleLabel: "Bundle",
      card: "Card",
      wallet: "Wallet",
      selectBundle: "Select...",
      cardModeEthereumOnly: "Card mode is currently available on Ethereum only.",
      transakCurrency: "Currency (Transak payment)",
      amount: "Amount",
      quantityBundleTokens: "Amount (bundle tokens)",
      slippage: "Slippage",
      estimatedTokens: "Est. tokens",
      estimatedEthRequired: "Estimated ETH required",
      feesHint: "Fees: on-ramp ~1% + variable gas",
      continueWithCard: "Continue with card",
      confirmSwap: "Confirm swap",
      actionFailed: "Action failed. Retry.",
      unablePrice: "Unable to fetch price. Retry.",
      ethCost: "ETH cost",
      ethReceived: "ETH received",
      chooseBundle: "Choose a bundle",
      pendingSwap: "ETH detected. Bundle purchase in progress...",
      pendingPayment:
        "Payment is being confirmed (on-ramp). The swap will start automatically after confirmation.",
      paymentFailed: "On-ramp payment failed. Please start a new purchase.",
      swapFailed: "Auto-swap failed. No automatic retry will be started.",
      fundsReceived: "ETH received. The bundle swap will start automatically.",
      transakTestMode:
        "Thirdweb Pay test mode (Transak staging): test card only, no real debit. On Ethereum mainnet, Transak may show a successful order while no ETH is credited - use this mode mainly to validate UI flow and intent status. To test real bundle swap funding, use Wallet mode on testnet (Fuji) or a small mainnet amount outside test mode.",
      transakKycHint:
        "Transak applies country/KYC constraints. The widget can adjust the final amount. Selected currency is used for the thirdweb quote; session country usually follows IP (unless overridden by project env variables).",
      slippageHintSuffix: "bps, web-aligned default 0.5%",
      buy: "Buy",
      sell: "Sell",
      errors: {
        invalidInput: "Invalid input.",
        noBundleSelected: "No bundle selected.",
        walletAndBundleRequired: "Wallet and bundle are required.",
        amountRequired: "Amount is required.",
        connectWallet: "Connect a wallet.",
        quoteRequired: "Quote is required.",
        noPendingPurchase: "No pending purchase found.",
        intentWrongNetwork: "One-click intent was created on another network.",
        bundleNotAllowed: "This token is not an allowed listed bundle.",
        insufficientBalance: "Insufficient balance after ETH reserve (~$2) and gas.",
        onRampUnavailable: "On-ramp is unavailable on this network.",
      },
    },
    chart: {
      notEnoughData: "Not enough data",
    },
    errors: {
      slippageOutOfRange: "Slippage is out of allowed range.",
      invalidOnRampUrl: "Invalid on-ramp URL.",
      untrustedOnRampProvider: "Untrusted on-ramp provider.",
      invalidAmount: "Invalid amount.",
      invalidEstimatedEthAmount: "Invalid estimated ETH amount.",
      onRampUnavailable: "On-ramp is unavailable on this network.",
      ethUsdRateUnavailable: "ETH/USD rate unavailable.",
      ethUsdParseError: "ETH/USD parse error.",
      invalidEthBudgetAfterSlippage: "Invalid ETH budget after slippage.",
      buyTransactionReverted: "Buy transaction reverted.",
      invalidMinEthOutAfterSlippage: "Invalid minimum ETH output after slippage.",
      sellTransactionReverted: "Sell transaction reverted.",
      approveReverted: "Approve reverted.",
      wsConnectionFailed: "WebSocket connection failed.",
      wsServerError: "WebSocket server error.",
      wsNotConnected: "WebSocket not connected.",
    },
  },
} as const;

type TranslationDictionary = typeof translations.en;
export type TranslationKey = RecursiveKeyOf<TranslationDictionary>;

type RecursiveKeyOf<T extends object> = {
  [K in keyof T & string]: T[K] extends object ? `${K}.${RecursiveKeyOf<T[K]>}` : K;
}[keyof T & string];

const i18n = new I18n(translations);
i18n.defaultLocale = "en";
i18n.enableFallback = true;
i18n.locale = getLocales()[0]?.languageCode ?? "en";

export function t(key: TranslationKey): string {
  return i18n.t(key);
}
