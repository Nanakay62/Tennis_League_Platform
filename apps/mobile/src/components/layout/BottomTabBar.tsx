import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Link, usePathname } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useThemeColors } from "../../theme/colors";
import { MIN_TOUCH_TARGET } from "../../theme/tokens";

interface TabItem {
  name: string;
  href: string;
  icon: keyof typeof Feather.glyphMap;
  exact?: boolean;
}

// Exactly 5 items (Constraint #3)
const TABS: TabItem[] = [
  { name: "Home", href: "/", icon: "home", exact: true },
  { name: "My League", href: "/divisions/div-comp-1", icon: "shield" },
  { name: "Scores", href: "/scores", icon: "clipboard" },
  { name: "Courts", href: "/courts", icon: "map-pin" },
  { name: "Community", href: "/community/poty", icon: "users" },
];

export function BottomTabBar() {
  const { colors } = useThemeColors();
  const pathname = usePathname();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      ]}
    >
      {TABS.map((tab) => {
        const isActive = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || (tab.href !== "/" && pathname.startsWith(tab.href));

        const iconColor = isActive ? colors.primary : colors.textSecondary;
        const textColor = isActive ? colors.primary : colors.textSecondary;

        return (
          <Link key={tab.href} href={tab.href as any} asChild>
            <TouchableOpacity
              style={styles.tabButton}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityLabel={tab.name}
              accessibilityState={{ selected: isActive }}
            >
              <Feather name={tab.icon} size={20} color={iconColor} />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: textColor,
                    fontWeight: isActive ? "700" : "500",
                  },
                ]}
                numberOfLines={1}
              >
                {tab.name}
              </Text>
            </TouchableOpacity>
          </Link>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderTopWidth: 1,
    paddingHorizontal: 8,
    zIndex: 10,
  },
  tabButton: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 3,
    letterSpacing: -0.1,
  },
});
