import { useMemo } from "react";
import { ConnectButton } from "thirdweb/react-native";
import { inAppWallet } from "thirdweb/wallets";

import { getThirdwebChain } from "@/lib/chain-runtime";
import { getThirdwebBrowserClient } from "@/lib/thirdweb";
import { useNetworkStore } from "@/store/network-store";

export function ConnectWalletButton() {
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
  return <ConnectButton client={client} chain={chain} wallets={wallets} />;
}
