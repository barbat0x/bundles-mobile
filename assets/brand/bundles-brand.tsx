/**
 * Logos bundles.fi — importés depuis bundles-frontend `public/assets/img/logo` (+ favicon).
 * Usage : <BundlesLogo width={180} height={37} /> (props react-native-svg)
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
 * Barre d’app : même graphisme que le favicon (un seul fichier `favicon.svg`, pas de copie).
 */
export function BundlesAppIcon(props: SvgProps) {
  return <FaviconSvg {...props} />;
}
