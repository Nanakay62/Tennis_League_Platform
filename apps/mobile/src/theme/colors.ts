import { useColorScheme } from "react-native";

export const lightColors = {
  // Brand & Accent
  primary: "#204b39",          // Deep forest green
  primaryLight: "#2d6a50",
  primaryDark: "#153327",
  accent: "#204b39",           // Primary accent
  accentSecondary: "#e8f0eb",  // Soft green badge/pill background

  // Surfaces & Backgrounds
  background: "#fcfbf9",       // Warm off-white canvas
  surface: "#ffffff",          // Clean card surface
  surfaceMuted: "#f7f6f2",     // Subtle container/table header
  surfaceSubtle: "#f4f3ee",    // Banner & low-emphasis row surface
  surfaceSecondary: "#f1f3f4", // Compatibility fallback

  // Borders
  border: "#e6e3dc",           // Neutral hairline border
  borderSubtle: "#edeae3",
  borderStrong: "#d4cebe",

  // Typography
  text: "#1c1917",             // High-contrast primary text
  textPrimary: "#1c1917",
  textSecondary: "#78716c",   // Muted label & subtitle
  textMuted: "#a8a29e",        // Subtle placeholder
  textInverse: "#ffffff",

  // Status & Feedback
  success: "#15803d",
  successBg: "#dcfce7",
  successText: "#15803d",
  warning: "#b45309",
  warningBg: "#fef3c7",
  warningText: "#b45309",
  danger: "#b91c1c",
  dangerBg: "#fee2e2",
  dangerText: "#b91c1c",

  // Badges & Pills
  badgeBg: "#e8f0eb",
  badgeText: "#204b39",

  // Sidebar (Desktop)
  sidebarBg: "#0d2b20",
  sidebarActive: "#1a4534",
  sidebarText: "#e6f0eb",
  sidebarTextMuted: "#8fa99c",
  sidebarBorder: "#1a4534",
};

export const darkColors = {
  // Brand & Accent
  primary: "#34d399",          // High-contrast emerald green on dark
  primaryLight: "#4ade80",
  primaryDark: "#10b981",
  accent: "#34d399",
  accentSecondary: "#16392b",

  // Surfaces & Backgrounds
  background: "#0d1413",       // Deep dark charcoal slate (no pitch black)
  surface: "#16221f",          // Elevated card surface
  surfaceMuted: "#1e2e2a",     // Table header / secondary container
  surfaceSubtle: "#192723",    // Low-emphasis banner
  surfaceSecondary: "#21322e",

  // Borders
  border: "#253934",           // Subtle dark border
  borderSubtle: "#1e2e2a",
  borderStrong: "#354f49",

  // Typography
  text: "#f0f6fc",             // Crisp light primary text
  textPrimary: "#f0f6fc",
  textSecondary: "#94a3b8",   // Cool slate secondary
  textMuted: "#64748b",        // Subtle placeholder
  textInverse: "#0d1413",

  // Status & Feedback
  success: "#4ade80",
  successBg: "#064e3b",
  successText: "#4ade80",
  warning: "#fbbf24",
  warningBg: "#451a03",
  warningText: "#fbbf24",
  danger: "#f87171",
  dangerBg: "#450a0a",
  dangerText: "#f87171",

  // Badges & Pills
  badgeBg: "#16392b",
  badgeText: "#34d399",

  // Sidebar (Desktop)
  sidebarBg: "#091a13",
  sidebarActive: "#123023",
  sidebarText: "#e6f0eb",
  sidebarTextMuted: "#749485",
  sidebarBorder: "#123023",
};

export type ThemeColors = typeof lightColors;
export type ThemeMode = "light" | "dark" | "system";

// The reference design is Light Mode. Default to light mode so the app
// matches the reference image out-of-the-box regardless of host OS dark-mode setting.
let activeThemeMode: ThemeMode = "light";

export function setThemeMode(mode: ThemeMode) {
  activeThemeMode = mode;
}

export function getThemeMode(): ThemeMode {
  return activeThemeMode;
}

// Default export preserving backwards compatibility
export const colors = lightColors;

/**
 * Hook returning current theme colors. Defaults to light mode to match
 * the reference design specification.
 */
export function useThemeColors(): {
  colors: ThemeColors;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
} {
  const scheme = useColorScheme();
  const isDark =
    activeThemeMode === "system" ? scheme === "dark" : activeThemeMode === "dark";

  return {
    colors: isDark ? darkColors : lightColors,
    isDark,
    setMode: setThemeMode,
  };
}

