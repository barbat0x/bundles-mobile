import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { BundlesAppIcon } from "@/assets/brand/bundles-brand";
import { uiTokens } from "@/lib/ui-tokens";

interface AppHeaderProps {
  /** Texte optionnel à droite du pictogramme (ex. titre d’écran). */
  title?: string;
  right?: ReactNode;
}

export function AppHeader({ title, right }: AppHeaderProps) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3 bg-bundle-card border-b border-bundle-border-subtle">
      <View className="flex-row items-center gap-2" accessibilityRole="header" accessibilityLabel="bundles.fi">
        <BundlesAppIcon width={28} height={28} accessibilityLabel="" />
        {title ? (
          <Text className="text-lg" style={{ fontFamily: uiTokens.fontFamily.sansSemibold, color: uiTokens.colors.textStrong }}>
            {title}
          </Text>
        ) : null}
      </View>
      <View className="flex-row items-center gap-3">
        {right}
        <Link href="/settings" asChild>
          <Pressable hitSlop={8}>
            <Ionicons name="settings-outline" size={22} color={uiTokens.colors.textPrimary} />
          </Pressable>
        </Link>
      </View>
    </View>
  );
}
