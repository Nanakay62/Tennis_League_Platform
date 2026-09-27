import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Link, usePathname } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useThemeColors } from "../../theme/colors";

interface NavItem {
  name: string;
  href: string;
  icon: keyof typeof Feather.glyphMap;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { name: "Home", href: "/", icon: "home", exact: true },
  { name: "My League", href: "/divisions/div-comp-1", icon: "shield" },
  { name: "Scores", href: "/scores", icon: "clipboard" },
  { name: "Courts", href: "/courts", icon: "map-pin" },
  { name: "Community", href: "/community/poty", icon: "users" },
];

export function Sidebar() {
  const { colors } = useThemeColors();
  const pathname = usePathname();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.sidebarBg,
          borderRightColor: colors.sidebarBorder,
        },
      ]}
    >
      {/* Brand Header */}
      <View style={styles.brandHeader}>
        <View style={styles.brandMark}>
          <Feather name="circle" size={14} color="#34d399" />
        </View>
        <Text style={[styles.brandTitle, { color: colors.sidebarText }]}>
          Frankfurt Tennis
        </Text>
      </View>

      {/* Nav Items */}
      <View style={styles.navList}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

          const navItemStyle = StyleSheet.flatten([
            styles.navItem,
            isActive && {
              backgroundColor: colors.sidebarActive,
            },
          ]);

          return (
            <Link key={item.href} href={item.href as any} asChild>
              <TouchableOpacity
                style={navItemStyle}
                activeOpacity={0.8}
                accessibilityRole="link"
                accessibilityLabel={item.name}
              >
                <Feather
                  name={item.icon}
                  size={18}
                  color={isActive ? "#34d399" : colors.sidebarTextMuted}
                  style={styles.navIcon}
                />
                <Text
                  style={[
                    styles.navText,
                    {
                      color: isActive ? "#ffffff" : colors.sidebarText,
                      fontWeight: isActive ? "700" : "500",
                    },
                  ]}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            </Link>
          );
        })}
      </View>

      {/* Footer Tagline (Constraint #10 - Original Copy) */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.sidebarTextMuted }]}>
          Frankfurt Flex League{"\n"}Fair play & local community
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 240,
    height: "100%",
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRightWidth: 1,
    justifyContent: "space-between",
  },
  brandHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    marginBottom: 28,
  },
  brandMark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    backgroundColor: "rgba(52, 211, 153, 0.15)",
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  navList: {
    flex: 1,
    gap: 4,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  navIcon: {
    marginRight: 12,
  },
  navText: {
    fontSize: 14,
  },
  footer: {
    paddingHorizontal: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
  },
  footerText: {
    fontSize: 11,
    lineHeight: 16,
  },
});
