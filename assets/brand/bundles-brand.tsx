/**
 * bundles.fi logos imported from bundles-frontend `public/assets/img/logo` (+ favicon).
 * Usage: <BundlesLogo width={180} height={37} /> (react-native-svg props)
 */
import type { SvgProps } from "react-native-svg";

import FaviconSvg from "./favicon.svg";
import IconSimpleSvg from "./icon-simple.svg";
import LogoSvg from "./logo.svg";

export function BundlesLogo(props: SvgProps) {
  return <LogoSvg {...props} />;
}

export function BundlesIconSimple(props: SvgProps) {
  return <IconSimpleSvg {...props} />;
}

export function BundlesFavicon(props: SvgProps) {
  return <FaviconSvg {...props} />;
}

/**
 * App bar icon uses the same favicon artwork (single `favicon.svg` source).
 */
export function BundlesAppIcon(props: SvgProps) {
  return <FaviconSvg {...props} />;
}
