import { Pressable, Text, View } from "react-native";

import { uiTokens } from "@/lib/ui-tokens";

/**
 * Mirrors `forms.css` `.radio-group` (muted) or primary pill selection (`buttons.css` feel).
 * - `muted`: border gray-200, selected surface gray-100 (Day theme explore filters).
 * - `emphasis`: selected segment = primary gray CTA (buy/sell, source de fonds).
 */
interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface BundlesSegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  variant?: "muted" | "emphasis";
}

export function BundlesSegmented<T extends string>({
  options,
  value,
  onChange,
  className,
  variant = "muted",
}: BundlesSegmentedProps<T>) {
  return (
    <View className={`flex-row border border-bundle-radio-border rounded-full p-1 ${className ?? ""}`}>
      {options.map((o) => {
        const selected = value === o.value;
        const selBg =
          variant === "emphasis"
            ? selected
              ? "bg-bundle-cta"
              : ""
            : selected
              ? "bg-bundle-radio-selected"
              : "";
        const selText =
          variant === "emphasis"
            ? selected
              ? "text-white opacity-100"
              : "text-bundle-muted opacity-60"
            : selected
              ? "text-bundle-text opacity-100"
              : "text-bundle-muted opacity-50";
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            className={`flex-1 py-2 rounded-full items-center ${selBg}`}
          >
            <Text
              className={`text-sm ${selText}`}
              style={{ fontFamily: selected ? uiTokens.fontFamily.sansMedium : uiTokens.fontFamily.sans }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
