import React, { useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useThemeColors } from "../src/theme/colors";
import {
  clearTokens,
  getRefreshToken,
  useCurrentUser,
  UserSession,
  saveCachedUserSession,
} from "../src/lib/auth";
import { API_BASE_URL } from "../src/api/client";
import { pickAndUploadAvatar } from "../src/api/avatar";
import { AppShell, Card, ListRow, Button, Badge, Avatar } from "../src/components";

export default function AccountScreen() {
  const { colors } = useThemeColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user, isLoading: loading } = useCurrentUser();
  const [isUploading, setIsUploading] = useState(false);

  async function handlePickAvatar() {
    try {
      setIsUploading(true);
      const res = await pickAndUploadAvatar();
      if (res) {
        queryClient.setQueryData<UserSession | null>(["currentUser"], (prev) =>
          prev ? { ...prev, avatarUrl: res.avatarUrl } : prev
        );
        if (user) {
          saveCachedUserSession({
            ...user,
            avatarUrl: res.avatarUrl,
          });
        }
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["currentUser"] }),
          queryClient.invalidateQueries({ queryKey: ["standings"] }),
          queryClient.invalidateQueries({ queryKey: ["scores"] }),
          queryClient.invalidateQueries({ queryKey: ["poty"] }),
          queryClient.invalidateQueries({ queryKey: ["partners"] }),
        ]);
      }
    } catch (err: any) {
      Alert.alert("Upload Error", err.message || "Failed to update profile photo.");
    } finally {
      setIsUploading(false);
    }
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
      queryClient.setQueryData(["currentUser"], null);
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      router.replace("/");
    }
  }

  if (loading) {
    return (
      <AppShell title="MY ACCOUNT">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell title="MY ACCOUNT">
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Account & Profile
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Manage your player credentials, preferences, and security settings.
        </Text>
      </View>

      {!user ? (
        <Card style={styles.guestCard} contentStyle={styles.guestContent}>
          <View style={[styles.guestIconCircle, { backgroundColor: colors.accentSecondary }]}>
            <Feather name="user" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.guestTitle, { color: colors.textPrimary }]}>
            Sign In to Accra Tennis
          </Text>
          <Text style={[styles.guestDesc, { color: colors.textSecondary }]}>
            Access your player profile, match reports, communications, and account settings.
          </Text>
          <View style={styles.btnRow}>
            <Button
              variant="primary"
              size="md"
              href="/(auth)/login"
              style={{ flex: 1 }}
            >
              Sign In
            </Button>
            <Button
              variant="secondary"
              size="md"
              href="/(auth)/register"
              style={{ flex: 1 }}
            >
              Create Account
            </Button>
          </View>
        </Card>
      ) : (
        <View style={styles.contentWrap}>
          {/* Profile Card */}
          <Card style={styles.profileCard} contentStyle={styles.profileCardContent}>
            <Avatar
              name={user.displayName}
              avatarUrl={user.avatarUrl}
              size="xl"
              showEditBadge
              onEditPress={handlePickAvatar}
              isLoading={isUploading}
            />

            <View style={styles.profileDetails}>
              <Text style={[styles.userName, { color: colors.textPrimary }]}>
                {user.displayName}
              </Text>
              <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
                {user.email}
              </Text>

              <View style={styles.tagRow}>
                <Badge label={`NTRP ${user.rating}`} variant="neutral" icon="shield" size="sm" />
                <Badge label={user.homeArea || "Accra"} variant="neutral" icon="map-pin" size="sm" />
                {user.isDaytime && (
                  <Badge label="Daytime (d)" variant="accent" icon="sun" size="sm" />
                )}
              </View>
            </View>
          </Card>

          {/* Settings List Card */}
          <Card title="Account Settings" noPadding>
            <ListRow
              icon="bell"
              title="Communication Settings"
              subtitle="Email & push notification preferences"
              href="/settings/notifications"
            />
            <ListRow
              icon="info"
              title="App Version"
              subtitle="System updates and market details"
              href="/settings/about"
            />
            <ListRow
              icon="trash-2"
              title="Delete My Data"
              subtitle="Anonymize results and delete account"
              href="/settings/delete-account"
              isLast
            />
          </Card>

          {/* Sign Out Button */}
          <Button
            variant="secondary"
            size="lg"
            onPress={handleLogout}
            icon="log-out"
            style={styles.logoutBtn}
          >
            Sign Out
          </Button>
        </View>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: "500",
  },
  loadingContainer: {
    padding: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  contentWrap: {
    gap: 12,
  },
  guestCard: {
    paddingVertical: 12,
  },
  guestContent: {
    alignItems: "center",
    padding: 24,
  },
  guestIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  guestTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  guestDesc: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
    maxWidth: 320,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  profileCard: {
    marginBottom: 4,
  },
  profileCardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "800",
  },
  profileDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    marginBottom: 8,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  logoutBtn: {
    marginTop: 8,
    marginBottom: 24,
  },
});
