import { useColorScheme } from "react-native";

export const lightColors = {
  primary: "#1b5e20", // Tennis court dark green
  primaryLight: "#2e7d32",
  accent: "#c0ca33", // Tennis ball yellow-green
  background: "#f8f9fa",
  surface: "#ffffff",
  surfaceSecondary: "#f1f3f4",
  border: "#e0e0e0",
  text: "#212121",
  textSecondary: "#616161",
  textMuted: "#9e9e9e",
  success: "#2e7d32",
  danger: "#c62828",
  badgeBg: "#e8f5e9",
  badgeText: "#1b5e20",
};

export const darkColors = {
  primary: "#4caf50", // Accessible bright green on dark backgrounds
  primaryLight: "#81c784",
  accent: "#dce775", // Tennis ball neon glow
  background: "#121212", // Pure dark background
  surface: "#1e1e1e", // Elevated dark surface
  surfaceSecondary: "#2c2c2c",
  border: "#3d3d3d",
  text: "#f5f5f5",
  textSecondary: "#b0b0b0",
  textMuted: "#757575",
  success: "#66bb6a",
  danger: "#ef5350",
  badgeBg: "#1b3a20",
  badgeText: "#a5d6a7",
};

// Default export preserving backwards compatibility
export const colors = lightColors;

/**
 * Hook returning current theme colors respecting device light/dark mode preference.
 */
export function useThemeColors() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  return {
    colors: isDark ? darkColors : lightColors,
    isDark,
  };
}
