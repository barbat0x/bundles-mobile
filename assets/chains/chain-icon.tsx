/**
 * Chain icons from the same source files used by bundles-frontend:
 * `public/assets/img/chains/*.svg`.
 */
import type { ComponentType } from "react";
import type { SvgProps } from "react-native-svg";

import C1 from "./1.svg";
import C5 from "./5.svg";
import C137 from "./137.svg";
import C280 from "./280.svg";
import C324 from "./324.svg";
import C1101 from "./1101.svg";
import C1337 from "./1337.svg";
import C1442 from "./1442.svg";
import C8453 from "./8453.svg";
import C80001 from "./80001.svg";
import C42161 from "./42161.svg";
import C421614 from "./421614.svg";
import C43113 from "./43113.svg";
import C43114 from "./43114.svg";
import C11155111 from "./11155111.svg";
import Default from "./default.svg";

const BY_ID: Record<number, ComponentType<SvgProps>> = {
  1: C1,
  5: C5,
  137: C137,
  280: C280,
  324: C324,
  1101: C1101,
  1337: C1337,
  1442: C1442,
  8453: C8453,
  80001: C80001,
  42161: C42161,
  421614: C421614,
  43113: C43113,
  43114: C43114,
  11155111: C11155111,
};

export type ChainIconProps = SvgProps & {
  chainId: number;
};

export function ChainIcon({ chainId, ...rest }: ChainIconProps) {
  const Cmp = BY_ID[chainId] ?? Default;
  return <Cmp {...rest} />;
}
