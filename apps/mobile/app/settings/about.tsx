import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useThemeColors } from "../../src/theme/colors";
import { API_BASE_URL } from "../../src/api/client";
import { AppShell, Card, Badge } from "../../src/components";

export default function AboutScreen() {
  const { colors } = useThemeColors();
  const [versionInfo, setVersionInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchVersion() {
      try {
        const res = await fetch(`${API_BASE_URL}/app/version?platform=${Platform.OS}`);
        if (res.ok) {
          const data = await res.json();
          setVersionInfo(data);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchVersion();
  }, []);

  return (
    <AppShell title="ABOUT" showBack>
      <View style={styles.wrapper}>
        <Card style={styles.card} contentStyle={styles.cardContent}>
          <View style={[styles.brandMark, { backgroundColor: colors.accentSecondary }]}>
            <Feather name="circle" size={24} color={colors.primary} />
          </View>

          <Text style={[styles.appName, { color: colors.textPrimary }]}>
            Accra Tennis League
          </Text>
          <Text style={[styles.versionLabel, { color: colors.textSecondary }]}>
            Version 1.0.0 (Build 2026.1)
          </Text>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 14 }} />
          ) : (
            <Badge
              label="Your app is up to date"
              variant="success"
              icon="check-circle"
              size="md"
              style={{ marginBottom: 20 }}
            />
          )}

          <View style={[styles.infoList, { borderColor: colors.borderSubtle }]}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Platform</Text>
              <Text style={[styles.infoVal, { color: colors.textPrimary }]}>
                {Platform.OS.toUpperCase()}
              </Text>
            </View>

            <View style={[styles.infoRow, { borderTopColor: colors.borderSubtle, borderTopWidth: 1 }]}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Market</Text>
              <Text style={[styles.infoVal, { color: colors.textPrimary }]}>
                Accra / Tema, Ghana
              </Text>
            </View>

            <View style={[styles.infoRow, { borderTopColor: colors.borderSubtle, borderTopWidth: 1 }]}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Time Zone</Text>
              <Text style={[styles.infoVal, { color: colors.textPrimary }]}>
                Africa/Accra
              </Text>
            </View>

            <View style={[styles.infoRow, { borderTopColor: colors.borderSubtle, borderTopWidth: 1 }]}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Currency</Text>
              <Text style={[styles.infoVal, { color: colors.textPrimary }]}>
                GHS (GH₵)
              </Text>
            </View>
          </View>

          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            Designed for Accra & Tema flex singles players. Built on FastAPI & Expo.
          </Text>
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
    maxWidth: 480,
  },
  cardContent: {
    alignItems: "center",
    padding: 24,
  },
  brandMark: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  appName: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  versionLabel: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 12,
  },
  infoList: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  infoVal: {
    fontSize: 13,
    fontWeight: "700",
  },
  footerText: {
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
  },
});
