import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { colors } from "../../src/theme/colors";
import { API_BASE_URL } from "../../src/api/client";
import { getAccessToken } from "../../src/lib/auth";

export default function NotificationsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    email_kickoff: true,
    email_reminders: true,
    email_results: true,
    push_kickoff: true,
    push_reminders: true,
    push_results: true,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const token = await getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/me/communication-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } finally {
      setLoading(false);
    }
  }

  async function toggleSetting(key: keyof typeof settings, value: boolean) {
    const updated = { ...settings, [key]: value };
    setSettings(updated);

    const token = await getAccessToken();
    if (!token) return;

    setSaving(true);
    try {
      await fetch(`${API_BASE_URL}/me/communication-settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updated),
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.headerTitle}>Communication Settings</Text>
      <Text style={styles.headerSubtitle}>
        Manage what updates and notifications you receive from Frankfurt Tennis League.
      </Text>

      {/* Email Section */}
      <View style={styles.card}>
        <Text style={styles.cardSection}>Email Notifications</Text>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Season & Division Kickoff</Text>
            <Text style={styles.rowDesc}>Division schedules, rosters, and opponent contacts</Text>
          </View>
          <Switch
            value={settings.email_kickoff}
            onValueChange={(val) => toggleSetting("email_kickoff", val)}
            trackColor={{ true: colors.primary }}
          />
        </View>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Weekly Match Reminders</Text>
            <Text style={styles.rowDesc}>Gentle reminders to schedule your weekly flex match</Text>
          </View>
          <Switch
            value={settings.email_reminders}
            onValueChange={(val) => toggleSetting("email_reminders", val)}
            trackColor={{ true: colors.primary }}
          />
        </View>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Match Score Reports & Confirmations</Text>
            <Text style={styles.rowDesc}>Immediate alerts when an opponent submits a score</Text>
          </View>
          <Switch
            value={settings.email_results}
            onValueChange={(val) => toggleSetting("email_results", val)}
            trackColor={{ true: colors.primary }}
          />
        </View>
      </View>

      {/* Push Section */}
      <View style={styles.card}>
        <Text style={styles.cardSection}>Mobile Push Notifications</Text>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Kickoff Alerts</Text>
            <Text style={styles.rowDesc}>Push notification when divisions are published</Text>
          </View>
          <Switch
            value={settings.push_kickoff}
            onValueChange={(val) => toggleSetting("push_kickoff", val)}
            trackColor={{ true: colors.primary }}
          />
        </View>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Weekly Schedule Nudges</Text>
            <Text style={styles.rowDesc}>Reminders when a match hasn't been played in 7 days</Text>
          </View>
          <Switch
            value={settings.push_reminders}
            onValueChange={(val) => toggleSetting("push_reminders", val)}
            trackColor={{ true: colors.primary }}
          />
        </View>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Score Confirmations & Disputes</Text>
            <Text style={styles.rowDesc}>Real-time notification to confirm or dispute match scores</Text>
          </View>
          <Switch
            value={settings.push_results}
            onValueChange={(val) => toggleSetting("push_results", val)}
            trackColor={{ true: colors.primary }}
          />
        </View>
      </View>
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
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 18,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    marginBottom: 16,
  },
  cardSection: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingVertical: 10,
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowText: {
    flex: 1,
    paddingRight: 16,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  rowDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
});
