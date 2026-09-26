import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { colors } from "../../src/theme/colors";
import { API_BASE_URL } from "../../src/api/client";

export default function AboutScreen() {
  const [versionInfo, setVersionInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVersion();
  }, []);

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

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoText}>🎾</Text>
        </View>
        <Text style={styles.appName}>Frankfurt Tennis League</Text>
        <Text style={styles.versionLabel}>Version 1.0.0 (Build 2026.1)</Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
        ) : (
          <View style={styles.statusBox}>
            <Text style={styles.statusIcon}>✓</Text>
            <Text style={styles.statusText}>Your app is up to date.</Text>
          </View>
        )}

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Platform</Text>
          <Text style={styles.infoVal}>{Platform.OS.toUpperCase()}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Market</Text>
          <Text style={styles.infoVal}>Frankfurt am Main</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Time Zone</Text>
          <Text style={styles.infoVal}>Europe/Berlin</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Currency</Text>
          <Text style={styles.infoVal}>EUR (€)</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  logoText: {
    fontSize: 28,
  },
  appName: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },
  versionLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 16,
  },
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.badgeBg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 20,
    gap: 8,
  },
  statusIcon: {
    color: colors.badgeText,
    fontWeight: "bold",
  },
  statusText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.badgeText,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  infoVal: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
});
