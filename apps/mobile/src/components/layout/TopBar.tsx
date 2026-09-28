import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { Link, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useThemeColors } from "../../theme/colors";
import { fetchCurrentUser, UserSession } from "../../lib/auth";
import { getPlayerAvatar } from "../../constants/mockImages";

import { useResponsive } from "../../theme/tokens";

export interface TopBarProps {
  showBack?: boolean;
  onBack?: () => void;
  title?: string;
}

/**
 * Top bar carrying strictly notifications and the account menu (Constraint #4).
 * Matches reference image:
 * - Desktop: User profile with name & dropdown chevron, red notification bell dot
 * - Mobile: Frankfurt Tennis brandmark on left, bell & avatar on right
 */
export function TopBar({ showBack = false, onBack, title }: TopBarProps) {
  const { colors } = useThemeColors();
  const { isDesktop } = useResponsive();
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);

  useEffect(() => {
    fetchCurrentUser().then(setUser).catch(() => {});
  }, []);

  const displayName = user?.displayName || "Max Weber";

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
        },
      ]}
    >
      {/* Left: Brand mark on mobile, or Back button if enabled */}
      <View style={styles.leftSection}>
        {showBack ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack ? onBack : () => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Feather name="chevron-left" size={20} color={colors.textPrimary} />
            <Text style={[styles.backText, { color: colors.textPrimary }]}>Back</Text>
          </TouchableOpacity>
        ) : !isDesktop ? (
          <Link href="/" asChild>
            <TouchableOpacity style={styles.brandLink}>
              <View style={[styles.brandMark, { backgroundColor: colors.primary }]}>
                <Feather name="circle" size={14} color="#34d399" />
              </View>
              <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>
                {title || "Frankfurt Tennis"}
              </Text>
            </TouchableOpacity>
          </Link>
        ) : (
          <View />
        )}
      </View>

      {/* Right: Notifications (Red badge) & Account Menu (Name + Dropdown on desktop) */}
      <View style={styles.rightSection}>
        <Link href="/settings/notifications" asChild>
          <TouchableOpacity
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Feather name="bell" size={18} color={colors.textSecondary} />
            <View style={[styles.unreadDot, { backgroundColor: "#ef4444" }]} />
          </TouchableOpacity>
        </Link>

        <Link href="/account" asChild>
          <TouchableOpacity
            style={styles.profileWrapper}
            accessibilityRole="button"
            accessibilityLabel="My Account"
          >
            <View
              style={StyleSheet.flatten([
                styles.avatarButton,
                {
                  borderColor: colors.borderSubtle,
                },
              ])}
            >
              <Image
                source={getPlayerAvatar(displayName)}
                style={styles.avatarImage}
              />
            </View>

            {isDesktop && (
              <View style={styles.userDropdownRow}>
                <Text style={[styles.userNameText, { color: colors.textPrimary }]}>
                  {displayName}
                </Text>
                <Feather
                  name="chevron-down"
                  size={14}
                  color={colors.textSecondary}
                  style={{ marginLeft: 4 }}
                />
              </View>
            )}
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  brandLink: {
    flexDirection: "row",
    alignItems: "center",
  },
  brandMark: {
    width: 14,
    height: 14,
    borderRadius: 3,
    marginRight: 8,
  },
  brandTitle: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  backText: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 2,
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  unreadDot: {
    position: "absolute",
    top: 7,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  avatarButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: "700",
  },
  profileWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  userDropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },
  userNameText: {
    fontSize: 13,
    fontWeight: "600",
  },
});

