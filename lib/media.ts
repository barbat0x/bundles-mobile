import Constants from "expo-constants";
import { getAddress, type Address } from "viem";

import { DEFAULT_CHAIN_ID, type SupportedChainId } from "@/lib/chains";

/**
 * Same source as bundles-frontend `Token.getIconUrl()`:
 * `${mediaServerEndpoint}/tokens/${chainId}/${address}.svg`
 *
 * Assets are not stored in this repo; they are served from `media.bundles.fi`.
 */
export function getMediaOrigin(): string {
  return (
    process.env.EXPO_PUBLIC_MEDIA_ORIGIN ??
    (Constants.expoConfig?.extra as { EXPO_PUBLIC_MEDIA_ORIGIN?: string } | undefined)
      ?.EXPO_PUBLIC_MEDIA_ORIGIN ??
    "https://media.bundles.fi"
  ).replace(/\/$/, "");
}

/**
 * ERC-20 icon (SVG on CDN), EIP-55 checksummed address like web app.
 */
export function getErc20TokenIconUrl(chainId: number, tokenAddress: Address | string): string {
  const origin = getMediaOrigin();
  return `${origin}/tokens/${chainId}/${getAddress(tokenAddress as Address)}.svg`;
}

function getUploadsBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_UPLOADS_URL_ROOT;
  const fromExtra = (Constants.expoConfig?.extra as { EXPO_PUBLIC_UPLOADS_URL_ROOT?: string } | undefined)
    ?.EXPO_PUBLIC_UPLOADS_URL_ROOT;
  const raw = [fromEnv, fromExtra].find((v) => Boolean(v && String(v).trim().length > 0)) ?? "https://api.bundles.fi/uploads";
  return String(raw).replace(/\/$/, "");
}

/**
 * PLAN §6.7.4 - index / bundle icon (PNG), aligned with `IndexToken.getIconUrl()`:
 * `{uploads}/indexes/{chainId}/icons/{address}.png`
 */
export function bundleIconUrl(indexAddress: string, chainId: SupportedChainId = DEFAULT_CHAIN_ID): string {
  const base = getUploadsBase();
  return `${base}/indexes/${chainId}/icons/${getAddress(indexAddress as Address)}.png`;
}
