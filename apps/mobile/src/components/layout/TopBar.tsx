import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Link, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useThemeColors } from "../../theme/colors";
import { fetchCurrentUser, UserSession } from "../../lib/auth";

export interface TopBarProps {
  showBack?: boolean;
  onBack?: () => void;
  title?: string;
}

/**
 * Top bar carrying strictly notifications and the account menu (Constraint #4).
 * Never repeats navigation links that are in the desktop sidebar or mobile bottom tab bar.
 */
export function TopBar({ showBack = false, onBack, title }: TopBarProps) {
  const { colors } = useThemeColors();
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);

  useEffect(() => {
    fetchCurrentUser().then(setUser).catch(() => {});
  }, []);

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
      {/* Left: Brand mark or Back button */}
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
        ) : (
          <Link href="/" asChild>
            <TouchableOpacity style={styles.brandLink}>
              <View style={[styles.brandMark, { backgroundColor: colors.primary }]} />
              <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>
                {title || "FRANKFURT TENNIS"}
              </Text>
            </TouchableOpacity>
          </Link>
        )}
      </View>

      {/* Right: Notifications & Account Menu only (Constraint #4) */}
      <View style={styles.rightSection}>
        <Link href="/settings/notifications" asChild>
          <TouchableOpacity
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Feather name="bell" size={18} color={colors.textSecondary} />
            <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
          </TouchableOpacity>
        </Link>

        <Link href="/account" asChild>
          <TouchableOpacity
            style={[
              styles.avatarButton,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.borderSubtle,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="My Account"
          >
            {user?.displayName ? (
              <Text style={[styles.avatarText, { color: colors.textPrimary }]}>
                {user.displayName.charAt(0).toUpperCase()}
              </Text>
            ) : (
              <Feather name="user" size={16} color={colors.textSecondary} />
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
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
