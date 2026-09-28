import { Platform, useWindowDimensions } from "react-native";

/**
 * System font stack:
 * - iOS: San Francisco ("System")
 * - Android: "Roboto"
 * - Web: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
 * Zero bundle size, feels native everywhere, and handles German umlauts and ß out of the box.
 */
export const systemFontFamily = Platform.select({
  ios: "System",
  android: "Roboto",
  web: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  default: "system-ui, -apple-system, sans-serif",
});

export const fonts = {
  family: systemFontFamily,
  weights: {
    regular: "400",
    medium: "500",
    semiBold: "600",
    bold: "700",
    heavy: "800",
  },
} as const;


export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 30,
} as const;

export const fontWeight = {
  regular: "400",
  medium: "500",
  semiBold: "600",
  bold: "700",
  heavy: "800",
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

/** Minimum touch target size in logical points adhering to WCAG 2.1 AA and Apple HIG (44x44pt). */
export const MIN_TOUCH_TARGET = 44;

export const breakpoints = {
  mobileMax: 767,
  tabletMin: 768,
  desktopMin: 1024,
} as const;

export interface ResponsiveInfo {
  width: number;
  height: number;
  isMobile: boolean;    // < 768px (e.g. 375px iPhone)
  isTablet: boolean;    // >= 768px and < 1024px
  isDesktop: boolean;   // >= 1024px (e.g. desktop web)
  numColumns: number;   // 1 for mobile, 2 for tablet, 3 for desktop
}

export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions();
  const isMobile = width < breakpoints.tabletMin;
  const isTablet = width >= breakpoints.tabletMin && width < breakpoints.desktopMin;
  const isDesktop = width >= breakpoints.desktopMin;

  const numColumns = isDesktop ? 3 : isTablet ? 2 : 1;

  return {
    width,
    height,
    isMobile,
    isTablet,
    isDesktop,
    numColumns,
  };
}
