import Constants from "expo-constants";
import { z } from "zod";

const schema = z.object({
  EXPO_PUBLIC_THIRDWEB_CLIENT_ID: z.string().min(1, "EXPO_PUBLIC_THIRDWEB_CLIENT_ID required"),
  EXPO_PUBLIC_API_WS_ENDPOINT: z.string().min(1),
  EXPO_PUBLIC_GRAPH_API_KEY: z.string().min(1),
  EXPO_PUBLIC_RPC_FALLBACK_URL: z.string().url().default("https://0xrpc.io/eth"),
  EXPO_PUBLIC_SENTRY_DSN: z.string().optional(),
  EXPO_PUBLIC_TRANSAK_API_KEY: z.string().optional(),
  /**
   * When `"true"`, thirdweb Pay `getBuyWithFiatQuote` uses `isTestMode` (Transak staging / test cards).
   * Never set to `"true"` in production builds.
   */
  EXPO_PUBLIC_THIRDWEB_PAY_TEST_MODE: z.enum(["true", "false"]).optional(),
  /** Optional — used for PLAN §6.5.1 price fallback when WS unavailable */
  EXPO_PUBLIC_ALCHEMY_API_KEY: z.string().optional(),
});

export type PublicEnv = z.infer<typeof schema>;

function readExtra(): Record<string, unknown> {
  const ex = Constants.expoConfig?.extra;
  return ex && typeof ex === "object" ? (ex as Record<string, unknown>) : {};
}

function fromProcess(): Record<string, string | undefined> {
  return {
    EXPO_PUBLIC_THIRDWEB_CLIENT_ID: process.env.EXPO_PUBLIC_THIRDWEB_CLIENT_ID,
    EXPO_PUBLIC_API_WS_ENDPOINT: process.env.EXPO_PUBLIC_API_WS_ENDPOINT,
    EXPO_PUBLIC_GRAPH_API_KEY: process.env.EXPO_PUBLIC_GRAPH_API_KEY,
    EXPO_PUBLIC_RPC_FALLBACK_URL: process.env.EXPO_PUBLIC_RPC_FALLBACK_URL,
    EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
    EXPO_PUBLIC_TRANSAK_API_KEY: process.env.EXPO_PUBLIC_TRANSAK_API_KEY,
    EXPO_PUBLIC_THIRDWEB_PAY_TEST_MODE: process.env.EXPO_PUBLIC_THIRDWEB_PAY_TEST_MODE,
    EXPO_PUBLIC_ALCHEMY_API_KEY: process.env.EXPO_PUBLIC_ALCHEMY_API_KEY,
  };
}

/** Prefer first non-empty string — `app.json` extra often uses "" as placeholder and must not override `.env`. */
function pick(extraVal: unknown, procVal: string | undefined): string | undefined {
  const a = typeof extraVal === "string" ? extraVal.trim() : "";
  if (a !== "") return a;
  const b = procVal?.trim();
  return b !== "" ? b : undefined;
}

let cached: PublicEnv | null = null;

/** Validated public env — throws if misconfigured (fail fast in dev). */
export function getEnv(): PublicEnv {
  if (cached) return cached;
  const extra = readExtra();
  const proc = fromProcess();
  const merged = {
    EXPO_PUBLIC_THIRDWEB_CLIENT_ID: pick(extra.EXPO_PUBLIC_THIRDWEB_CLIENT_ID, proc.EXPO_PUBLIC_THIRDWEB_CLIENT_ID),
    EXPO_PUBLIC_API_WS_ENDPOINT: pick(extra.EXPO_PUBLIC_API_WS_ENDPOINT, proc.EXPO_PUBLIC_API_WS_ENDPOINT),
    EXPO_PUBLIC_GRAPH_API_KEY: pick(extra.EXPO_PUBLIC_GRAPH_API_KEY, proc.EXPO_PUBLIC_GRAPH_API_KEY),
    EXPO_PUBLIC_RPC_FALLBACK_URL: pick(extra.EXPO_PUBLIC_RPC_FALLBACK_URL, proc.EXPO_PUBLIC_RPC_FALLBACK_URL),
    EXPO_PUBLIC_SENTRY_DSN: pick(extra.EXPO_PUBLIC_SENTRY_DSN, proc.EXPO_PUBLIC_SENTRY_DSN),
    EXPO_PUBLIC_TRANSAK_API_KEY: pick(extra.EXPO_PUBLIC_TRANSAK_API_KEY, proc.EXPO_PUBLIC_TRANSAK_API_KEY),
    EXPO_PUBLIC_THIRDWEB_PAY_TEST_MODE: pick(
      extra.EXPO_PUBLIC_THIRDWEB_PAY_TEST_MODE,
      proc.EXPO_PUBLIC_THIRDWEB_PAY_TEST_MODE,
    ),
    EXPO_PUBLIC_ALCHEMY_API_KEY: pick(extra.EXPO_PUBLIC_ALCHEMY_API_KEY, proc.EXPO_PUBLIC_ALCHEMY_API_KEY),
  };
  cached = schema.parse(merged);
  return cached;
}

/** thirdweb Pay fiat on-ramp in provider test mode (staging / dummy cards). */
export function isThirdwebPayTestMode(): boolean {
  return getEnv().EXPO_PUBLIC_THIRDWEB_PAY_TEST_MODE === "true";
}
