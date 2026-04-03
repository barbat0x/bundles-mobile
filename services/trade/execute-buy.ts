import { universalRouterAbi } from "@bundlesfi/universal-router";
import type { ThirdwebClient } from "thirdweb";
import { encodeFunctionData } from "viem";
import { prepareTransaction, sendTransaction, waitForReceipt } from "thirdweb";
import type { Account } from "thirdweb/wallets";
import type { Chain } from "thirdweb/chains";
import type { Address, PublicClient } from "viem";

import type { SupportedChainId } from "@/lib/chains";
import { getContracts, SLIPPAGE_BPS, TX_DEADLINE_SECONDS } from "@/lib/contracts";
import { amountMaxAfterSlippageUp, toSlippageBpsBigint } from "@/lib/slippage";
import { buyBundle } from "@/services/universal-router-client";
import { t } from "@/lib/i18n";
import type { SwapExecutionProgressEvent } from "@/features/trade/swap-execution-state";

export type BuyArgs = {
  publicClient: PublicClient;
  twClient: ThirdwebClient;
  twChain: Chain;
  chainId: SupportedChainId;
  account: Account;
  bundleAddress: Address;
  desiredBundleAmount: bigint;
  slippageBps?: bigint;
  onProgress?: (event: SwapExecutionProgressEvent) => void;
};

export async function executeBuy(a: BuyArgs): Promise<{ transactionHash: string }> {
  const contracts = getContracts(a.chainId);
  const quote = await buyBundle(a.publicClient, a.bundleAddress, a.desiredBundleAmount, {
    deadline: BigInt(TX_DEADLINE_SECONDS),
  });

  const bps = toSlippageBpsBigint(a.slippageBps, SLIPPAGE_BPS);
  const ethWithSlippage = amountMaxAfterSlippageUp(quote.ethCost, bps);
  if (ethWithSlippage <= quote.ethCost) {
    throw new Error(t("errors.invalidEthBudgetAfterSlippage"));
  }
  const deadline = BigInt(Math.floor(Date.now() / 1000) + TX_DEADLINE_SECONDS);

  const transaction = prepareTransaction({
    client: a.twClient,
    chain: a.twChain,
    to: contracts.universalRouter,
    value: ethWithSlippage,
    data: encodeFunctionData({
      abi: universalRouterAbi,
      functionName: "swapETHForExactTokens",
      args: [a.bundleAddress, a.desiredBundleAmount, quote.calldata, deadline],
    }),
  });

  a.onProgress?.({ step: "swap_pending", status: "pending" });
  const submitted = await sendTransaction({
    account: a.account,
    transaction,
  });
  a.onProgress?.({ step: "swap_submitted", status: "done", txHash: submitted.transactionHash });

  const receipt = await waitForReceipt({
    client: a.twClient,
    chain: a.twChain,
    transactionHash: submitted.transactionHash,
  });

  if (receipt.status !== "success") {
    a.onProgress?.({
      step: "swap_confirmed",
      status: "failed",
      txHash: submitted.transactionHash,
      errorMessage: t("errors.buyTransactionReverted"),
    });
    throw new Error(t("errors.buyTransactionReverted"));
  }
  a.onProgress?.({ step: "swap_confirmed", status: "done", txHash: submitted.transactionHash });

  return { transactionHash: submitted.transactionHash };
}