import React from "react";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "../src/theme/colors";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 2, // 2 minutes
    },
  },
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: colors.primary,
            },
            headerTintColor: "#fff",
            headerTitleStyle: {
              fontWeight: "600",
            },
            contentStyle: {
              backgroundColor: colors.background,
            },
          }}
        >
          <Stack.Screen name="index" options={{ title: "Frankfurt Tennis League" }} />
          <Stack.Screen name="programs/index" options={{ title: "Programs" }} />
          <Stack.Screen name="programs/[programId]" options={{ title: "Select Division" }} />
          <Stack.Screen name="divisions/[divisionId]" options={{ title: "Standings" }} />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
