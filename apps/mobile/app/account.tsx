import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Alert, TextInput, TouchableOpacity, Linking } from "react-native";
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
import { API_BASE_URL, updatePlayerProfile } from "../src/api/client";
import { pickAndUploadAvatar } from "../src/api/avatar";
import { AppShell, Card, ListRow, Button, Badge, Avatar } from "../src/components";

export default function AccountScreen() {
  const { colors } = useThemeColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user, isLoading: loading } = useCurrentUser();
  const [isUploading, setIsUploading] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editHomeArea, setEditHomeArea] = useState("Accra");
  const [editGender, setEditGender] = useState("unspecified");
  const [editBirthYear, setEditBirthYear] = useState("");
  const [editFavoriteLink, setEditFavoriteLink] = useState("");
  const [editGameDescription, setEditGameDescription] = useState("");
  const [editAboutMe, setEditAboutMe] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => {
      setEditHomeArea(user.homeArea || "Accra");
      setEditGender(user.gender || "unspecified");
      setEditBirthYear(user.birthYear ? String(user.birthYear) : "");
      setEditFavoriteLink(user.favoriteLink || "");
      setEditGameDescription(user.gameDescription || "");
      setEditAboutMe(user.aboutMe || "");
    }, 0);
    return () => clearTimeout(timer);
  }, [user]);

  async function handleSaveProfile() {
    try {
      setIsSavingProfile(true);
      const parsedYear = editBirthYear.trim() ? parseInt(editBirthYear.trim(), 10) : null;
      const trimmedLink = editFavoriteLink.trim();

      if (trimmedLink && !trimmedLink.startsWith("http://") && !trimmedLink.startsWith("https://")) {
        Alert.alert("Invalid URL", "Favorite link must begin with http:// or https://");
        setIsSavingProfile(false);
        return;
      }

      await updatePlayerProfile({
        home_area: editHomeArea,
        gender: editGender,
        birth_year: parsedYear,
        favorite_link: trimmedLink || null,
        game_description: editGameDescription.trim() || null,
        about_me: editAboutMe.trim() || null,
      });

      if (user) {
        const updatedSession = {
          ...user,
          homeArea: editHomeArea,
          gender: editGender,
          birthYear: parsedYear,
          favoriteLink: trimmedLink || null,
          gameDescription: editGameDescription.trim() || null,
          aboutMe: editAboutMe.trim() || null,
        };
        saveCachedUserSession(updatedSession);
        queryClient.setQueryData(["currentUser"], updatedSession);
      }
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      setIsEditingProfile(false);
      Alert.alert("Success", "Profile details updated successfully.");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update profile.");
    } finally {
      setIsSavingProfile(false);
    }
  }

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
                {user.gender && user.gender !== "unspecified" && (
                  <Badge
                    label={user.gender === "male" ? "Men's" : user.gender === "female" ? "Women's" : "Non-binary"}
                    variant="neutral"
                    icon="user"
                    size="sm"
                  />
                )}
                {Boolean(user.birthYear) && (
                  <Badge label={`Born ${user.birthYear}`} variant="neutral" icon="calendar" size="sm" />
                )}
              </View>

              {Boolean(user.gameDescription) && (
                <View style={{ marginTop: 10 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textSecondary, textTransform: "uppercase" }}>
                    Playing Style & Tactics
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textPrimary, marginTop: 2, lineHeight: 18 }}>
                    {user.gameDescription}
                  </Text>
                </View>
              )}

              {Boolean(user.aboutMe) && (
                <View style={{ marginTop: 10 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textSecondary, textTransform: "uppercase" }}>
                    About Me
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textPrimary, marginTop: 2, lineHeight: 18 }}>
                    {user.aboutMe}
                  </Text>
                </View>
              )}

              {Boolean(user.favoriteLink) && (
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}
                  onPress={() => Linking.openURL(user.favoriteLink!)}
                >
                  <Feather name="external-link" size={13} color={colors.primary} style={{ marginRight: 5 }} />
                  <Text style={{ fontSize: 12, color: colors.primary, textDecorationLine: "underline" }} numberOfLines={1}>
                    {user.favoriteLink}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => setIsEditingProfile(!isEditingProfile)}
                style={{ marginTop: 10, alignSelf: "flex-start" }}
              >
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>
                  {isEditingProfile ? "Close Profile Edit" : "Edit Profile Info"}
                </Text>
              </TouchableOpacity>
            </View>
          </Card>

          {isEditingProfile && (
            <Card title="Player Profile Details">
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Home Playing Region / Area
              </Text>
              <View style={styles.genderRow}>
                {["Accra", "Tema"].map((area) => (
                  <TouchableOpacity
                    key={area}
                    style={[
                      styles.genderBtn,
                      { borderColor: colors.border, backgroundColor: colors.surfaceMuted },
                      editHomeArea === area && {
                        borderColor: colors.primary,
                        backgroundColor: colors.accentSecondary,
                      },
                    ]}
                    onPress={() => setEditHomeArea(area)}
                  >
                    <Text
                      style={[
                        styles.genderBtnText,
                        { color: colors.textSecondary },
                        editHomeArea === area && { color: colors.primary, fontWeight: "700" },
                      ]}
                    >
                      {area}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 14 }]}>
                Gender (for division qualification)
              </Text>
              <View style={styles.genderRow}>
                {[
                  { id: "male", label: "Male" },
                  { id: "female", label: "Female" },
                  { id: "non_binary", label: "Non-binary" },
                  { id: "unspecified", label: "Prefer not to say" },
                ].map((g) => (
                  <TouchableOpacity
                    key={g.id}
                    style={[
                      styles.genderBtn,
                      { borderColor: colors.border, backgroundColor: colors.surfaceMuted },
                      editGender === g.id && {
                        borderColor: colors.primary,
                        backgroundColor: colors.accentSecondary,
                      },
                    ]}
                    onPress={() => setEditGender(g.id)}
                  >
                    <Text
                      style={[
                        styles.genderBtnText,
                        { color: colors.textSecondary },
                        editGender === g.id && { color: colors.primary, fontWeight: "700" },
                      ]}
                    >
                      {g.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 14 }]}>
                Birth Year (required for 40+ senior divisions)
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceMuted,
                    color: colors.textPrimary,
                  },
                ]}
                value={editBirthYear}
                onChangeText={setEditBirthYear}
                placeholder="e.g. 1984"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={4}
              />

              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  Playing Style & Tactics (optional)
                </Text>
                <Text style={{ fontSize: 11, color: colors.textMuted }}>
                  {editGameDescription.length}/500
                </Text>
              </View>
              <TextInput
                style={[
                  styles.textArea,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceMuted,
                    color: colors.textPrimary,
                  },
                ]}
                value={editGameDescription}
                onChangeText={setEditGameDescription}
                placeholder="e.g. Aggressive baseliner, heavy topspin forehand, slice backhand"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                maxLength={500}
              />

              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  About Me (optional)
                </Text>
                <Text style={{ fontSize: 11, color: colors.textMuted }}>
                  {editAboutMe.length}/1000
                </Text>
              </View>
              <TextInput
                style={[
                  styles.textArea,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceMuted,
                    color: colors.textPrimary,
                  },
                ]}
                value={editAboutMe}
                onChangeText={setEditAboutMe}
                placeholder="e.g. Weekday morning or weekend player looking for competitive matches."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
                maxLength={1000}
              />

              <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 14 }]}>
                Favorite Link (optional)
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceMuted,
                    color: colors.textPrimary,
                  },
                ]}
                value={editFavoriteLink}
                onChangeText={setEditFavoriteLink}
                placeholder="https://..."
                placeholderTextColor={colors.textMuted}
                keyboardType="url"
                autoCapitalize="none"
                maxLength={512}
              />
              {Boolean(editFavoriteLink.trim()) &&
                !editFavoriteLink.trim().startsWith("http://") &&
                !editFavoriteLink.trim().startsWith("https://") && (
                  <Text style={{ fontSize: 11, color: colors.danger, marginTop: -8, marginBottom: 10 }}>
                    Link must begin with http:// or https://
                  </Text>
                )}

              <View style={styles.editBtnRow}>
                <Button
                  variant="primary"
                  size="md"
                  onPress={handleSaveProfile}
                  loading={isSavingProfile}
                  style={{ flex: 1 }}
                >
                  Save Profile
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onPress={() => setIsEditingProfile(false)}
                  disabled={isSavingProfile}
                >
                  Cancel
                </Button>
              </View>
            </Card>
          )}

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
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  genderRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  genderBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  genderBtnText: {
    fontSize: 13,
    fontWeight: "500",
  },
  textInput: {
    height: 42,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 12,
  },
  textArea: {
    minHeight: 70,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 12,
    textAlignVertical: "top",
  },
  editBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  logoutBtn: {
    marginTop: 8,
    marginBottom: 24,
  },
});
