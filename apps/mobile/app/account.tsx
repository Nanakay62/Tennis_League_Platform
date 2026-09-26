import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { colors } from "../src/theme/colors";
import { clearTokens, fetchCurrentUser, getRefreshToken, UserSession } from "../src/lib/auth";
import { API_BASE_URL } from "../src/api/client";

export default function AccountScreen() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    setLoading(true);
    const session = await fetchCurrentUser();
    setUser(session);
    setLoading(false);
  }

  async function handleLogout() {
    try {
      const refresh = await getRefreshToken();
      if (refresh) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refresh }),
        }).catch(() => {});
      }
    } finally {
      await clearTokens();
      setUser(null);
      router.replace("/");
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.guestCard}>
          <Text style={styles.guestTitle}>Sign In to Frankfurt Tennis</Text>
          <Text style={styles.guestDesc}>
            Access your player profile, match reports, communications, and account settings.
          </Text>
          <View style={styles.btnRow}>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.8}>
                <Text style={styles.primaryBtnText}>Sign In</Text>
              </TouchableOpacity>
            </Link>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.8}>
                <Text style={styles.secondaryBtnText}>Create Account</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user.displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.userName}>{user.displayName}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>
        <View style={styles.tagRow}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>NTRP {user.rating}</Text>
          </View>
          <View style={styles.tag}>
            <Text style={styles.tagText}>📍 {user.homeArea}</Text>
          </View>
          {user.isDaytime && (
            <View style={[styles.tag, styles.daytimeTag]}>
              <Text style={styles.daytimeTagText}>☀️ Daytime (d)</Text>
            </View>
          )}
        </View>
      </View>

      {/* Menu Options */}
      <View style={styles.menuCard}>
        <Text style={styles.menuSectionHeader}>Account & Settings</Text>

        <Link href="/settings/notifications" asChild>
          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
            <Text style={styles.menuIcon}>🔔</Text>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>Communication Settings</Text>
              <Text style={styles.menuDesc}>Email & push notification preferences</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/settings/about" asChild>
          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
            <Text style={styles.menuIcon}>📱</Text>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>App Version</Text>
              <Text style={styles.menuDesc}>View version and updates</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/settings/delete-account" asChild>
          <TouchableOpacity style={[styles.menuItem, styles.menuItemDanger]} activeOpacity={0.7}>
            <Text style={styles.menuIcon}>🗑️</Text>
            <View style={styles.menuTextContainer}>
              <Text style={[styles.menuTitle, styles.dangerText]}>Delete My Data</Text>
              <Text style={styles.menuDesc}>Anonymize results and delete account</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </Link>
      </View>

      {/* Sign Out Button */}
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <Text style={styles.logoutBtnText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    maxWidth: 600,
    width: "100%",
    alignSelf: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  guestCard: {
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    marginTop: 40,
  },
  guestTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 8,
  },
  guestDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  btnRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  primaryBtn: {
    flex: 1,
    height: 44,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryBtn: {
    flex: 1,
    height: 44,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  secondaryBtnText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  profileCard: {
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    marginBottom: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.badgeBg,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.badgeText,
  },
  userName: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },
  userEmail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 12,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  tag: {
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  daytimeTag: {
    backgroundColor: "#fff8e1",
    borderColor: "#ffe082",
  },
  daytimeTagText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#f57f17",
  },
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    marginBottom: 20,
  },
  menuSectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingVertical: 10,
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  menuItemDanger: {
    borderTopColor: colors.border,
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 14,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  dangerText: {
    color: colors.danger,
  },
  menuDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  menuArrow: {
    fontSize: 20,
    color: colors.textSecondary,
    fontWeight: "400",
  },
  logoutBtn: {
    height: 46,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  logoutBtnText: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: "700",
  },
});
