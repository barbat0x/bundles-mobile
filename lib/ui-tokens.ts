/**
 * Design tokens aligned with `bundles-frontend` (Vue dApp), **light theme only**.
 * Dark mode on web uses `dark:` variants — we intentionally map **only the light side**
 * (default / Day theme) for React Native.
 *
 * Sources: `global.css`, `tailwind.css` (@theme gold), `buttons.css`, `forms.css`,
 * list/card patterns (`IndexListView`, `TokenListView`), `index.html`.
 */
export const themeMode = "light" as const;

export const uiTokens = {
  colors: {
    /** Page — gray-100 */
    bg: "#F3F4F6",
    bgAlt: "#F4F4F8",
    /** Cards / panels — white */
    card: "#FFFFFF",
    /** Default border — gray-300 (`border-gray-300`) */
    border: "#D1D5DB",
    /** Softer border — gray-200 (list rows, cards on explore) */
    borderSubtle: "#E5E7EB",
    /** Inputs — `forms.css` light */
    inputBg: "#F9FAFB",
    inputBorder: "#D1D5DB",
    inputPlaceholder: "#9CA3AF",
    /** Body — gray-700 */
    textPrimary: "#374151",
    textStrong: "#151516",
    textSecondary: "#6B7280",
    textMuted: "#9CA3AF",
    link: "#1D4ED8",
    /** `btn-primary` light */
    ctaPrimary: "#374151",
    ctaPrimaryHover: "#4B5563",
    ctaPrimaryText: "#FFFFFF",
    /** `btn-secondary` light */
    ctaSecondaryBg: "#F3F4F6",
    ctaSecondaryBorder: "#D1D5DB",
    ctaSecondaryText: "#374151",
    /** `btn-success` */
    success: "#059669",
    successHover: "#10B981",
    /** `btn-danger` — pink-600 */
    danger: "#DB2777",
    dangerHover: "#BE185D",
    positive: "#16A34A",
    negative: "#E11D48",
    gold: "#E8E100",
    chartLine: "#84D6A2",
    /** `btn-highlight` — pink→rose gradient approximated as solid for RN */
    highlight: "#EC4899",
    highlightEnd: "#F43F5E",
    disabled: "#9CA3AF",
    disabledBg: "#9CA3AF",
  },
  radius: {
    /** `rounded-md` inputs, cards */
    md: 6,
    /** `rounded-lg` */
    lg: 8,
    /** `rounded-xl` */
    xl: 12,
    /** `.btn` — `rounded-full` */
    pill: 9999,
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  /** Horizontal padding for `.btn` — `px-4`, vertical `py-1` base (we use py-2.5 on mobile touch) */
  button: {
    paddingX: 16,
    paddingY: 10,
  },
  /** `forms.css`: `py-3 px-6` */
  input: {
    paddingY: 12,
    paddingX: 16,
  },
  fontFamily: {
    sans: "Outfit_300Light",
    sansRegular: "Outfit_400Regular",
    sansMedium: "Outfit_500Medium",
    sansSemibold: "Outfit_600SemiBold",
    sansBold: "Outfit_700Bold",
    mono: "AzeretMono_400Regular",
    monoMedium: "AzeretMono_500Medium",
  },
} as const;
