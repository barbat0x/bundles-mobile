import { TextInput, type TextInputProps } from "react-native";

import { uiTokens } from "@/lib/ui-tokens";

/** Mirrors `bundles-frontend` `forms.css` light inputs: `rounded-md`, gray-50 bg, gray-300 border. */
export function BundlesTextInput({ className, style, ...rest }: TextInputProps) {
  const base =
    "rounded-md border border-bundle-input-border bg-bundle-input-bg px-4 py-3 text-bundle-text";
  return (
    <TextInput
      placeholderTextColor={uiTokens.colors.inputPlaceholder}
      className={[base, className].filter(Boolean).join(" ")}
      style={[style, { fontFamily: uiTokens.fontFamily.sans }]}
      {...rest}
    />
  );
}
