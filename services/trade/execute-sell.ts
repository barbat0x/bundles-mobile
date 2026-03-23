import { universalRouterAbi } from "@bundlesfi/universal-router";
import type { ThirdwebClient } from "thirdweb";
import { encodeFunctionData } from "viem";
import { prepareTransaction, sendTransaction, waitForReceipt } from "thirdweb";
import type { Account } from "thirdweb/wallets";
import type { Chain } from "thirdweb/chains";
import type { Address, PublicClient } from "viem";

import type { SupportedChainId } from "@/lib/chains";
import { getContracts, SLIPPAGE_BPS, TX_DEADLINE_SECONDS } from "@/lib/contracts";
import { amountMinAfterSlippage, toSlippageBpsBigint } from "@/lib/slippage";
import { sellBundle } from "@/services/universal-router-client";

import { approveIfNeeded } from "./approve-if-needed";

export type SellArgs = {
  publicClient: PublicClient;
  twClient: ThirdwebClient;
  twChain: Chain;
  chainId: SupportedChainId;
  account: Account;
  bundleAddress: Address;
  bundleAmountIn: bigint;
  slippageBps?: bigint;
};

export async function executeSell(a: SellArgs): Promise<{ transactionHash: string }> {
  const contracts = getContracts(a.chainId);
  await approveIfNeeded({
    publicClient: a.publicClient,
    twClient: a.twClient,
    twChain: a.twChain,
    chainId: a.chainId,
    account: a.account,
    token: a.bundleAddress,
    amount: a.bundleAmountIn,
  });

  const quote = await sellBundle(a.publicClient, a.bundleAddress, a.bundleAmountIn, {
    deadline: BigInt(TX_DEADLINE_SECONDS),
  });

  const bps = toSlippageBpsBigint(a.slippageBps, SLIPPAGE_BPS);
  const minEthOut = amountMinAfterSlippage(quote.ethProceeds, bps);
  if (minEthOut <= 0n) {
    throw new Error("Montant ETH minimal après slippage invalide");
  }
  const deadline = BigInt(Math.floor(Date.now() / 1000) + TX_DEADLINE_SECONDS);

  const transaction = prepareTransaction({
    client: a.twClient,
    chain: a.twChain,
    to: contracts.universalRouter,
    value: 0n,
    data: encodeFunctionData({
      abi: universalRouterAbi,
      functionName: "swapExactTokensForETH",
      args: [a.bundleAddress, a.bundleAmountIn, minEthOut, quote.calldata, deadline],
    }),
  });

  const submitted = await sendTransaction({
    account: a.account,
    transaction,
  });

  const receipt = await waitForReceipt({
    client: a.twClient,
    chain: a.twChain,
    transactionHash: submitted.transactionHash,
  });

  if (receipt.status !== "success") {
    throw new Error("Sell transaction reverted");
  }

  return { transactionHash: submitted.transactionHash };
}
