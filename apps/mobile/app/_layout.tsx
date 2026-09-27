import React from "react";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors, useThemeColors } from "../src/theme/colors";
import { OfflineBanner } from "../src/components/OfflineBanner";

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

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={isDark ? "light" : "light"} />
        <OfflineBanner />
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: themeColors.primary,
            },
            headerTintColor: "#fff",
            headerTitleStyle: {
              fontWeight: "700",
            },
            contentStyle: {
              backgroundColor: themeColors.background,
            },
          }}
        >
          <Stack.Screen name="index" options={{ title: "Frankfurt Tennis League" }} />
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
