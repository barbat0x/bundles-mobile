/** @type {import('tailwindcss').Config} */
/**
 * Light-only palette: mirrors `bundles-frontend` **non-dark** Tailwind classes.
 * (No `dark:` — mobile ships Day theme only.)
 */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./features/**/*.{js,jsx,ts,tsx}",
    "./providers/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Outfit_300Light"],
        outfit: ["Outfit_300Light"],
        "outfit-medium": ["Outfit_500Medium"],
        "outfit-semibold": ["Outfit_600SemiBold"],
        mono: ["AzeretMono_400Regular"],
      },
      colors: {
        bundle: {
          bg: "#F3F4F6",
          "bg-alt": "#F4F4F8",
          card: "#FFFFFF",
          border: "#D1D5DB",
          "border-subtle": "#E5E7EB",
          "input-bg": "#F9FAFB",
          "input-border": "#D1D5DB",
          text: "#374151",
          strong: "#151516",
          muted: "#6B7280",
          "text-muted-light": "#9CA3AF",
          link: "#1D4ED8",
          cta: "#374151",
          "cta-hover": "#4B5563",
          ctaText: "#FFFFFF",
          "secondary-bg": "#F3F4F6",
          "secondary-border": "#D1D5DB",
          "secondary-text": "#374151",
          success: "#059669",
          "success-hover": "#10B981",
          danger: "#DB2777",
          "danger-hover": "#BE185D",
          positive: "#16A34A",
          negative: "#E11D48",
          gold: "#E8E100",
          "chart-line": "#84D6A2",
          highlight: "#EC4899",
          "highlight-end": "#F43F5E",
          disabled: "#9CA3AF",
          "radio-selected": "#F3F4F6",
          "radio-border": "#E5E7EB",
        },
      },
    },
  },
  plugins: [],
};
