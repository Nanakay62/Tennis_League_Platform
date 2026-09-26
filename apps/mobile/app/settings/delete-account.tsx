import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { colors } from "../../src/theme/colors";
import { API_BASE_URL } from "../../src/api/client";
import { clearTokens, getAccessToken } from "../../src/lib/auth";

export default function DeleteAccountScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleDeleteAccount() {
    const token = await getAccessToken();
    if (!token) {
      router.replace("/");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(`${API_BASE_URL}/me`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Could not process account deletion. Please try again.");
      }

      await clearTokens();
      router.replace("/");
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.warningIcon}>⚠️</Text>
        <Text style={styles.title}>Delete My Account</Text>
        <Text style={styles.subtitle}>
          Please read this notice before permanently deleting your account.
        </Text>

        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>What happens when you delete your data:</Text>
          <Text style={styles.noticeItem}>
            • <Text style={styles.bold}>Personal Data Removed:</Text> Your email address, phone number, and password credentials will be permanently erased.
          </Text>
          <Text style={styles.noticeItem}>
            • <Text style={styles.bold}>Historical Standings Protected:</Text> To prevent disrupting current and previous division standings, your past match scores will be retained but displayed under the name <Text style={styles.bold}>"Former Player"</Text>.
          </Text>
          <Text style={styles.noticeItem}>
            • <Text style={styles.bold}>Immediate Revocation:</Text> All active login sessions on web and mobile devices will be immediately terminated.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.deleteButton, loading && styles.deleteButtonDisabled]}
          onPress={handleDeleteAccount}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.deleteButtonText}>Permanently Delete My Account</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={styles.cancelButtonText}>Cancel & Keep Account</Text>
        </TouchableOpacity>
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
    maxWidth: 500,
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  warningIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.danger,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  errorText: {
    color: colors.danger,
    backgroundColor: "#ffebee",
    padding: 10,
    borderRadius: 6,
    marginBottom: 16,
    fontSize: 13,
    width: "100%",
  },
  noticeBox: {
    backgroundColor: colors.surfaceSecondary,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    width: "100%",
    marginBottom: 24,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 10,
  },
  noticeItem: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  bold: {
    fontWeight: "700",
    color: colors.text,
  },
  deleteButton: {
    width: "100%",
    height: 46,
    backgroundColor: colors.danger,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    marginBottom: 12,
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  cancelButton: {
    paddingVertical: 10,
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
});
