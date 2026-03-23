import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import { uiTokens } from "@/lib/ui-tokens";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: uiTokens.colors.ctaPrimary,
        tabBarInactiveTintColor: uiTokens.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: uiTokens.colors.card,
          borderTopColor: uiTokens.colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Bundles",
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: "Portfolio",
          tabBarIcon: ({ color, size }) => <Ionicons name="pie-chart-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="trade"
        options={{
          title: "Trade",
          tabBarIcon: ({ color, size }) => <Ionicons name="swap-horizontal" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
