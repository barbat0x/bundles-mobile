import type { Address } from "viem";

import type { BundleIndex } from "@/types";

export function isBundleAddressAllowed(address: Address, bundles: BundleIndex[]): boolean {
  const id = address.toLowerCase();
  return bundles.some((b) => b.address.toLowerCase() === id);
}
