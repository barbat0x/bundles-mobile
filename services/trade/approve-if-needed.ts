import type { ThirdwebClient } from "thirdweb";
import { getContract } from "thirdweb/contract";
import { approve } from "thirdweb/extensions/erc20";
import { sendTransaction, waitForReceipt } from "thirdweb";
import type { Account } from "thirdweb/wallets";
import type { Chain } from "thirdweb/chains";
import type { Address, PublicClient } from "viem";
import { erc20Abi } from "viem";

import type { SupportedChainId } from "@/lib/chains";
import { getContracts } from "@/lib/contracts";
import { t } from "@/lib/i18n";

type Args = {
  publicClient: PublicClient;
  twClient: ThirdwebClient;
  twChain: Chain;
  chainId: SupportedChainId;
  account: Account;
  token: Address;
  amount: bigint;
};

export async function approveIfNeeded(a: Args): Promise<void> {
  const contracts = getContracts(a.chainId);
  const allowance = await a.publicClient.readContract({
    address: a.token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [a.account.address as Address, contracts.universalRouter],
  });
  if (allowance >= a.amount) return;

  const contract = getContract({
    client: a.twClient,
    chain: a.twChain,
    address: a.token,
  });
  const transaction = approve({
    contract,
    spender: contracts.universalRouter,
    amountWei: a.amount,
  });
  const submitted = await sendTransaction({ account: a.account, transaction });
  const receipt = await waitForReceipt({
    client: a.twClient,
    chain: a.twChain,
    transactionHash: submitted.transactionHash,
  });
  if (receipt.status !== "success") {
    throw new Error(t("errors.approveReverted"));
  }
}