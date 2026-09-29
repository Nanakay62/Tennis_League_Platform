import React from "react";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Platform } from "react-native";
import { useFonts } from "expo-font";
import Feather from "@expo/vector-icons/Feather";
import { colors, useThemeColors } from "../src/theme/colors";
import { OfflineBanner } from "../src/components/OfflineBanner";

// Inject native system fonts for web environment (San Francisco, Roboto, system-ui)
// Applied to root document elements without overriding custom icon fonts (e.g. Feather).
if (Platform.OS === "web" && typeof document !== "undefined") {
  const styleId = "tennis-league-system-fonts";
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement("style");
    styleEl.id = styleId;
    styleEl.textContent = `
      html, body, input, select, textarea {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      /* Protect icon font glyphs from being overridden by system-ui */
      [style*="font-family: feather"],
      [style*="font-family: Feather"],
      [class*="r-fontFamily-feather"],
      [class*="r-fontFamily-Feather"] {
        font-family: 'feather', 'Feather' !important;
      }
    `;
    document.head.appendChild(styleEl);
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 2, // 2 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours offline persistence
      networkMode: "offlineFirst",
    },
  },
});

export default function RootLayout() {
  const { colors: themeColors, isDark } = useThemeColors();
  const [fontsLoaded] = useFonts(Feather.font);

  // Wait for icon font before rendering on native; allow immediate rendering on web to prevent React 18 hydration error #418
  if (!fontsLoaded && Platform.OS !== "web") return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <OfflineBanner />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: themeColors.background,
            },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="programs/index" options={{ title: "Programs" }} />
          <Stack.Screen name="programs/[programId]" options={{ title: "Select Division" }} />
          <Stack.Screen name="divisions/[divisionId]" options={{ title: "Division" }} />
          <Stack.Screen name="scores/index" options={{ title: "Latest Scores" }} />
          <Stack.Screen name="scores/submit" options={{ title: "Report Score" }} />
          <Stack.Screen name="courts/index" options={{ title: "Frankfurt Courts" }} />
          <Stack.Screen name="partners/index" options={{ title: "Partner Program" }} />
          <Stack.Screen name="community/poty" options={{ title: "Player of the Year" }} />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
