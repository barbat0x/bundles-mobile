import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";

import { uiTokens } from "@/lib/ui-tokens";

/** Mirrors `bundles-frontend` `src/assets/css/buttons.css` — light theme only. */
export type BundlesButtonVariant =
  | "primary"
  | "secondary"
  | "transparent"
  | "highlight"
  | "success"
  | "danger";

export interface BundlesButtonProps extends Omit<PressableProps, "children"> {
  variant?: BundlesButtonVariant;
  /** `btn-sm` — smaller text/padding */
  size?: "default" | "sm";
  loading?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<BundlesButtonVariant, string> = {
  primary: "bg-bundle-cta",
  secondary: "bg-bundle-secondary-bg border border-bundle-border",
  transparent: "bg-transparent border border-bundle-border",
  highlight: "bg-bundle-highlight border border-pink-600",
  success: "bg-bundle-success border border-transparent",
  danger: "bg-bundle-danger border border-transparent",
};

const textClasses: Record<BundlesButtonVariant, string> = {
  primary: "text-white",
  secondary: "text-bundle-text",
  transparent: "text-bundle-text",
  highlight: "text-white",
  success: "text-white",
  danger: "text-white",
};

export function BundlesButton({
  variant = "primary",
  size = "default",
  loading,
  disabled,
  children,
  className,
  ...rest
}: BundlesButtonProps) {
  const isDisabled = disabled || loading;
  const hasFixedHeight = Boolean(className && /(^|\s)h-\S+/.test(className));
  const disabledStateClass =
    isDisabled && variant === "primary"
      ? "bg-[#AA03B6] border-0"
      : isDisabled
        ? "opacity-50"
        : "";
  const base =
    "rounded-[20px] items-center justify-center flex-row gap-2 active:opacity-90 " + disabledStateClass;
  const pad = hasFixedHeight ? "px-4" : size === "sm" ? "px-4 py-2" : "px-4 py-3";
  const merged = [base, pad, variantClasses[variant], className].filter(Boolean).join(" ");

  const spinnerColor =
    variant === "secondary" || variant === "transparent" ? uiTokens.colors.ctaPrimary : "#ffffff";

  return (
    <Pressable disabled={isDisabled} className={merged} {...rest}>
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <Text
          className={`${textClasses[variant]} ${size === "sm" ? "text-sm" : "text-base"}`}
          style={{ fontFamily: uiTokens.fontFamily.sansSemibold }}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}
