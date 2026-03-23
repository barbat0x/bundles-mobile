import { useMemo } from "react";
import { ConnectButton, lightTheme } from "thirdweb/react-native";
import { inAppWallet } from "thirdweb/wallets";

import { getThirdwebChain } from "@/lib/chain-runtime";
import { getThirdwebBrowserClient } from "@/lib/thirdweb";
import { useNetworkStore } from "@/store/network-store";

type ConnectWalletButtonVariant = "default" | "onboarding";

interface ConnectWalletButtonProps {
  variant?: ConnectWalletButtonVariant;
  label?: string;
}

export function ConnectWalletButton({ variant = "default", label }: ConnectWalletButtonProps) {
  const activeChainId = useNetworkStore((s) => s.activeChainId);
  const client = useMemo(() => getThirdwebBrowserClient(), []);
  const chain = useMemo(() => getThirdwebChain(activeChainId), [activeChainId]);
  const wallets = useMemo(
    () => [
      inAppWallet({
        executionMode: { mode: "EOA" },
        auth: { options: ["google", "email", "apple"] },
      }),
    ],
    [],
  );
  const onboardingConnectTheme = useMemo(
    () =>
      lightTheme({
        colors: {
          primaryButtonBg: "transparent",
          primaryButtonText: "#FFFFFF",
          modalBg: "#FFFFFF",
        },
      }),
    [],
  );
  const connectButtonConfig = useMemo(() => {
    if (!label) return undefined;
    if (variant !== "onboarding") return { label };
    return {
      label,
    };
  }, [label, variant]);

  return (
    <ConnectButton
      client={client}
      chain={chain}
      wallets={wallets}
      connectButton={connectButtonConfig}
      theme={variant === "onboarding" ? onboardingConnectTheme : undefined}
    />
  );
}
