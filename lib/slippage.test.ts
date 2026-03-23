import {
  amountMaxAfterSlippageUp,
  amountMinAfterSlippage,
  clampSlippageBps,
  DEFAULT_SLIPPAGE_BPS,
  SLIPPAGE_BPS_MAX,
  toSlippageBpsBigint,
} from "./slippage";

describe("slippage", () => {
  it("clamps to 1–200 bps range (invalid uses web-aligned default)", () => {
    expect(clampSlippageBps(0)).toBe(DEFAULT_SLIPPAGE_BPS);
    expect(clampSlippageBps(-5)).toBe(DEFAULT_SLIPPAGE_BPS);
    expect(clampSlippageBps(1)).toBe(1);
    expect(clampSlippageBps(50)).toBe(50);
    expect(clampSlippageBps(200)).toBe(200);
    expect(clampSlippageBps(9999)).toBe(SLIPPAGE_BPS_MAX);
  });

  it("matches bundles-frontend style: 0.5% on 10_000 wei → 9950 min out", () => {
    const amount = 10_000n;
    const bps = 50n;
    expect(amountMinAfterSlippage(amount, bps)).toBe(9950n);
    expect(amountMaxAfterSlippageUp(amount, bps)).toBe(10_050n);
  });

  it("rejects out-of-range bps bigint", () => {
    expect(() => toSlippageBpsBigint(0n, 50n)).toThrow();
    expect(() => toSlippageBpsBigint(10_000n, 50n)).toThrow();
    expect(toSlippageBpsBigint(undefined, 50n)).toBe(50n);
  });
});
