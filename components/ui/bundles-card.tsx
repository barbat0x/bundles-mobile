import { View, type ViewProps } from "react-native";

/** Explore / index list row: `bg-white border border-gray-200 rounded-md px-4 py-3` (light). */
export function BundlesCard({
  className,
  children,
  ...rest
}: ViewProps & { children: React.ReactNode }) {
  const base = "bg-bundle-card border border-bundle-border-subtle rounded-md p-4";
  return (
    <View className={[base, className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </View>
  );
}
