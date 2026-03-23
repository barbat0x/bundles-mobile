import { ethWeiFromUsdReserve } from "./mode-a-funds-state";

describe("ethWeiFromUsdReserve", () => {
  it("converts USD reserve to wei at given ETH price", () => {
    const wei = ethWeiFromUsdReserve(2, 4000);
    expect(wei).toBe(5n * 10n ** 14n);
  });
});
