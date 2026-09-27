import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useThemeColors } from "../../src/theme/colors";
import { API_BASE_URL } from "../../src/api/client";
import { clearTokens, getAccessToken } from "../../src/lib/auth";
import { AppShell, Card, Button } from "../../src/components";

export default function DeleteAccountScreen() {
  const { colors } = useThemeColors();
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
    <AppShell title="DELETE ACCOUNT" showBack>
      <View style={styles.wrapper}>
        <Card style={styles.card} contentStyle={styles.cardContent}>
          <View style={[styles.warningIconCircle, { backgroundColor: colors.dangerBg }]}>
            <Feather name="alert-octagon" size={32} color={colors.danger} />
          </View>

          <Text style={[styles.title, { color: colors.danger }]}>
            Delete My Account
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Please review what happens before permanently deleting your account data.
          </Text>

          {errorMsg ? (
            <View style={[styles.errorBox, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}>
              <Text style={[styles.errorText, { color: colors.danger }]}>{errorMsg}</Text>
            </View>
          ) : null}

          <View style={[styles.noticeBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.borderSubtle }]}>
            <Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>
              What happens when you delete your data:
            </Text>

            <View style={styles.noticeItem}>
              <Feather name="check" size={14} color={colors.danger} style={{ marginRight: 8, marginTop: 2 }} />
              <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
                <Text style={{ fontWeight: "700", color: colors.textPrimary }}>Personal Data Erased: </Text>
                Your email, phone number, and authentication tokens will be permanently deleted.
              </Text>
            </View>

            <View style={styles.noticeItem}>
              <Feather name="check" size={14} color={colors.danger} style={{ marginRight: 8, marginTop: 2 }} />
              <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
                <Text style={{ fontWeight: "700", color: colors.textPrimary }}>Standings Preserved: </Text>
                To avoid breaking division tables for your opponents, match results are kept but anonymized under <Text style={{ fontWeight: "700" }}>"Former Player"</Text>.
              </Text>
            </View>

            <View style={styles.noticeItem}>
              <Feather name="check" size={14} color={colors.danger} style={{ marginRight: 8, marginTop: 2 }} />
              <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
                <Text style={{ fontWeight: "700", color: colors.textPrimary }}>Immediate Sign Out: </Text>
                All active web and mobile device sessions are terminated immediately.
              </Text>
            </View>
          </View>

          <View style={styles.actionsContainer}>
            <Button
              variant="danger"
              size="lg"
              onPress={handleDeleteAccount}
              loading={loading}
              icon="trash-2"
              style={{ width: "100%", marginBottom: 10 }}
            >
              Permanently Delete Account
            </Button>

            <Button
              variant="secondary"
              size="md"
              onPress={() => router.back()}
              disabled={loading}
              style={{ width: "100%" }}
            >
              Cancel & Keep Account
            </Button>
          </View>
        </Card>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  card: {
    width: "100%",
    maxWidth: 500,
  },
  cardContent: {
    alignItems: "center",
    padding: 24,
  },
  warningIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
    maxWidth: 360,
  },
  errorBox: {
    width: "100%",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "600",
  },
  noticeBox: {
    width: "100%",
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
  },
  noticeItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  actionsContainer: {
    width: "100%",
  },
});
