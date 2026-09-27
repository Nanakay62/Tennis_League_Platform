import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeColors } from "../../theme/colors";
import { useResponsive } from "../../theme/tokens";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { BottomTabBar } from "./BottomTabBar";

export interface AppShellProps {
  children: React.ReactNode;
  showBack?: boolean;
  onBack?: () => void;
  title?: string;
  hideNav?: boolean;
  scrollable?: boolean;
}

export function AppShell({
  children,
  showBack = false,
  onBack,
  title,
  hideNav = false,
  scrollable = true,
}: AppShellProps) {
  const { colors } = useThemeColors();
  const { isDesktop } = useResponsive();

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: colors.background },
      ]}
      edges={["top"]}
    >
      <View style={styles.root}>
        {/* Desktop Sidebar (Only on wide screens >= 1024px) */}
        {isDesktop && !hideNav && <Sidebar />}

        {/* Main Application Area */}
        <View style={styles.mainArea}>
          {/* Top Bar (Notifications + Account Menu Only - Constraint #4) */}
          <TopBar showBack={showBack} onBack={onBack} title={title} />

          {/* Content Body */}
          {scrollable ? (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={styles.flexContent}>{children}</View>
          )}

          {/* Mobile Bottom Tab Bar (Strictly 5 items, only on screens < 1024px) */}
          {!isDesktop && !hideNav && <BottomTabBar />}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  root: {
    flex: 1,
    flexDirection: "row",
  },
  mainArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  scrollContent: {
    padding: 16,
    flexGrow: 1,
  },
  flexContent: {
    flex: 1,
    padding: 16,
  },
});
