/** PLAN §10.3 - PurchaseIntent JSON contract persisted in AsyncStorage. */
describe("PurchaseIntent JSON contract", () => {
  type Intent = {
    id: string;
    chainId: 1 | 43113;
    bundleAddress: `0x${string}`;
    desiredBundleAmount: string;
    expectedEthCost: string;
    onRampIntentId: string;
    status: "payment_pending" | "funds_pending" | "swapping" | "payment_failed" | "swap_failed";
    createdAt: number;
  };

  it("round-trips", () => {
    const intent: Intent = {
      id: "uuid",
      chainId: 1,
      bundleAddress: "0x2222222222222222222222222222222222222222",
      desiredBundleAmount: "1000000000000000000",
      expectedEthCost: "500000000000000000",
      onRampIntentId: "intent_123",
      status: "funds_pending",
      createdAt: 1700000000,
    };
    expect(JSON.parse(JSON.stringify(intent))).toEqual(intent);
  });
});
