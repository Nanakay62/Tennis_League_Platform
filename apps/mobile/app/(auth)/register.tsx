import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Link, useRouter, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { colors, useThemeColors } from "../../src/theme/colors";
import { API_BASE_URL } from "../../src/api/client";
import { saveTokens, fetchCurrentUser } from "../../src/lib/auth";
import { safeReturnTo } from "../../src/lib/safeReturnTo";

export default function RegisterScreen() {
  const router = useRouter();
  const { colors } = useThemeColors();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [rating, setRating] = useState("3.5");
  const [homeArea, setHomeArea] = useState("Accra");
  const [isDaytime, setIsDaytime] = useState(false);
  const [gender, setGender] = useState("unspecified");
  const [birthYear, setBirthYear] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleRegister() {
    if (!displayName || !email || !password) {
      setErrorMsg("Please fill in all required fields.");
      return;
    }

    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName.trim(),
          email: email.trim(),
          password,
          phone: phone.trim(),
          rating,
          home_area: homeArea.trim(),
          is_daytime: isDaytime,
          market_slug: "accra",
          gender,
          birth_year: birthYear.trim() ? parseInt(birthYear.trim(), 10) : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Registration failed.");
      }

      const tokens = await res.json();
      await saveTokens(tokens.access_token, tokens.refresh_token);

      // Pre-seed query cache immediately so TopBar & AccountScreen mount with user profile instantly
      const user = await fetchCurrentUser();
      queryClient.setQueryData(["currentUser"], user);
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });

      router.replace(safeReturnTo(returnTo) as never);
    } catch (err: any) {
      setErrorMsg(err.message || "Could not complete registration.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Join Accra Tennis</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Create your profile and skill rating
        </Text>

        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Full Name *</Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: colors.border,
                backgroundColor: colors.surfaceMuted,
                color: colors.textPrimary,
              },
            ]}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Enter your full name"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Email Address *</Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: colors.border,
                backgroundColor: colors.surfaceMuted,
                color: colors.textPrimary,
              },
            ]}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Password (min 8 chars) *</Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: colors.border,
                backgroundColor: colors.surfaceMuted,
                color: colors.textPrimary,
              },
            ]}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            Mobile Phone (for match scheduling)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: colors.border,
                backgroundColor: colors.surfaceMuted,
                color: colors.textPrimary,
              },
            ]}
            value={phone}
            onChangeText={setPhone}
            placeholder="+233 24 123 4567"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Self-Rated NTRP Level</Text>
          <View style={styles.ratingRow}>
            {["3.0", "3.5", "4.0", "4.5+"].map((r) => (
              <TouchableOpacity
                key={r}
                style={[
                  styles.ratingBtn,
                  { borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
                  rating === r && {
                    borderColor: colors.primary,
                    backgroundColor: colors.accentSecondary,
                  },
                ]}
                onPress={() => setRating(r)}
              >
                <Text
                  style={[
                    styles.ratingText,
                    { color: colors.textSecondary },
                    rating === r && { color: colors.primary, fontWeight: "700" },
                  ]}
                >
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            Home Playing Region / Area *
          </Text>
          <View style={styles.ratingRow}>
            {["Accra", "Tema"].map((area) => (
              <TouchableOpacity
                key={area}
                style={[
                  styles.ratingBtn,
                  { borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
                  homeArea === area && {
                    borderColor: colors.primary,
                    backgroundColor: colors.accentSecondary,
                  },
                ]}
                onPress={() => setHomeArea(area)}
              >
                <Text
                  style={[
                    styles.ratingText,
                    { color: colors.textSecondary },
                    homeArea === area && { color: colors.primary, fontWeight: "700" },
                  ]}
                >
                  {area}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            Gender (for division eligibility)
          </Text>
          <View style={styles.ratingRow}>
            {[
              { id: "male", label: "Male" },
              { id: "female", label: "Female" },
              { id: "non_binary", label: "Non-binary" },
              { id: "unspecified", label: "Skip" },
            ].map((g) => (
              <TouchableOpacity
                key={g.id}
                style={[
                  styles.ratingBtn,
                  { borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
                  gender === g.id && {
                    borderColor: colors.primary,
                    backgroundColor: colors.accentSecondary,
                  },
                ]}
                onPress={() => setGender(g.id)}
              >
                <Text
                  style={[
                    styles.ratingText,
                    { color: colors.textSecondary },
                    gender === g.id && { color: colors.primary, fontWeight: "700" },
                  ]}
                >
                  {g.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            Birth Year (optional — required for 40+ divisions)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: colors.border,
                backgroundColor: colors.surfaceMuted,
                color: colors.textPrimary,
              },
            ]}
            value={birthYear}
            onChangeText={setBirthYear}
            placeholder="e.g. 1984"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            maxLength={4}
          />
        </View>

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setIsDaytime(!isDaytime)}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.checkbox,
              { borderColor: colors.border, backgroundColor: colors.surface },
              isDaytime && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
          >
            {isDaytime ? <Text style={styles.checkmark}>✓</Text> : null}
          </View>
          <Text style={[styles.checkboxLabel, { color: colors.textSecondary }]}>
            I am available for daytime matches (displays as &quot;(d)&quot; in standings)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: colors.primary },
            loading && styles.buttonDisabled,
          ]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Register Account</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            Already have an account?{" "}
          </Text>
          <Link
            href={
              returnTo
                ? `/(auth)/login?returnTo=${encodeURIComponent(returnTo)}`
                : "/(auth)/login"
            }
            asChild
          >
            <TouchableOpacity>
              <Text style={[styles.linkText, { color: colors.primary }]}>Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    minHeight: "100%",
  },
  card: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  errorText: {
    color: colors.danger,
    backgroundColor: "#ffebee",
    padding: 10,
    borderRadius: 6,
    marginBottom: 16,
    fontSize: 13,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 6,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    backgroundColor: colors.surface,
  },
  ratingRow: {
    flexDirection: "row",
    gap: 8,
  },
  ratingBtn: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
  },
  ratingBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.badgeBg,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  ratingTextActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  button: {
    height: 46,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  linkText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
});
