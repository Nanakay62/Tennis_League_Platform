import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useThemeColors } from "../../src/theme/colors";
import { API_BASE_URL, getNotificationHistory, NotificationHistoryItem } from "../../src/api/client";
import { getAccessToken } from "../../src/lib/auth";
import { AppShell, Card, Badge } from "../../src/components";

export default function NotificationsScreen() {
  const { colors } = useThemeColors();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<NotificationHistoryItem[]>([]);
  const [settings, setSettings] = useState({
    email_kickoff: true,
    email_reminders: true,
    email_results: true,
    push_kickoff: true,
    push_reminders: true,
    push_results: true,
  });

  useEffect(() => {
    let active = true;
    async function loadSettings() {
      const token = await getAccessToken();
      if (!token) {
        if (active) setLoading(false);
        return;
      }

      try {
        const [res, historyData] = await Promise.all([
          fetch(`${API_BASE_URL}/me/communication-settings`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          getNotificationHistory(),
        ]);
        if (res.ok && active) {
          const data = await res.json();
          setSettings(data);
        }
        if (active) setHistory(historyData);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSettings();
    return () => {
      active = false;
    };
  }, []);

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
      <AppShell title="NOTIFICATIONS" showBack>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell title="NOTIFICATIONS" showBack>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Communication Settings
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Manage what alerts and updates you receive across email and push channels.
        </Text>
      </View>

      <View style={styles.contentWrap}>
        {/* Email Section */}
        <Card title="Email Notifications" noPadding>
          <View style={styles.switchRow}>
            <View style={styles.switchTextCol}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                Season & Division Kickoff
              </Text>
              <Text style={[styles.rowDesc, { color: colors.textSecondary }]}>
                Division schedules, rosters, and opponent contact details
              </Text>
            </View>
            <Switch
              value={settings.email_kickoff}
              onValueChange={(val) => toggleSetting("email_kickoff", val)}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>

          <View style={[styles.switchRow, { borderTopColor: colors.borderSubtle, borderTopWidth: 1 }]}>
            <View style={styles.switchTextCol}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                Weekly Match Reminders
              </Text>
              <Text style={[styles.rowDesc, { color: colors.textSecondary }]}>
                Gentle nudges to schedule your weekly flex match
              </Text>
            </View>
            <Switch
              value={settings.email_reminders}
              onValueChange={(val) => toggleSetting("email_reminders", val)}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>

          <View style={[styles.switchRow, { borderTopColor: colors.borderSubtle, borderTopWidth: 1 }]}>
            <View style={styles.switchTextCol}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                Score Reports & Confirmations
              </Text>
              <Text style={[styles.rowDesc, { color: colors.textSecondary }]}>
                Immediate alerts when an opponent submits a match score
              </Text>
            </View>
            <Switch
              value={settings.email_results}
              onValueChange={(val) => toggleSetting("email_results", val)}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        </Card>

        {/* Push Section */}
        <Card title="Mobile Push Notifications" noPadding>
          <View style={styles.switchRow}>
            <View style={styles.switchTextCol}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                Kickoff Alerts
              </Text>
              <Text style={[styles.rowDesc, { color: colors.textSecondary }]}>
                Push notification when divisions and opponents are published
              </Text>
            </View>
            <Switch
              value={settings.push_kickoff}
              onValueChange={(val) => toggleSetting("push_kickoff", val)}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>

          <View style={[styles.switchRow, { borderTopColor: colors.borderSubtle, borderTopWidth: 1 }]}>
            <View style={styles.switchTextCol}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                Weekly Schedule Nudges
              </Text>
              <Text style={[styles.rowDesc, { color: colors.textSecondary }]}>
                Reminders when a match hasn&apos;t been arranged in 7 days
              </Text>
            </View>
            <Switch
              value={settings.push_reminders}
              onValueChange={(val) => toggleSetting("push_reminders", val)}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>

          <View style={[styles.switchRow, { borderTopColor: colors.borderSubtle, borderTopWidth: 1 }]}>
            <View style={styles.switchTextCol}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                Score Confirmations & Disputes
              </Text>
              <Text style={[styles.rowDesc, { color: colors.textSecondary }]}>
                Real-time alert to confirm or dispute reported match scores
              </Text>
            </View>
            <Switch
              value={settings.push_results}
              onValueChange={(val) => toggleSetting("push_results", val)}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        </Card>

        {/* Recent Alerts Feed */}
        <Card title="Recent Alert History" noPadding>
          {history.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No notifications received yet.
              </Text>
            </View>
          ) : (
            history.map((item, idx) => {
              const isLast = idx === history.length - 1;
              const iconName = item.event_type === "kickoff" ? "calendar" : item.event_type === "reminders" ? "clock" : "check-circle";

              return (
                <View
                  key={item.id}
                  style={[
                    styles.historyRow,
                    !isLast && { borderBottomColor: colors.borderSubtle, borderBottomWidth: 1 },
                  ]}
                >
                  <View style={[styles.historyIconCircle, { backgroundColor: colors.accentSecondary }]}>
                    <Feather name={iconName} size={16} color={colors.primary} />
                  </View>

                  <View style={styles.historyContent}>
                    <View style={styles.historyTopLine}>
                      <Text style={[styles.historyTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Badge label={item.channel.toUpperCase()} variant="neutral" size="sm" />
                    </View>

                    <Text style={[styles.historyBody, { color: colors.textSecondary }]}>
                      {item.body}
                    </Text>

                    <Text style={[styles.historyTime, { color: colors.textMuted }]}>
                      {new Date(item.created_at).toLocaleDateString("de-DE", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </Card>
      </View>
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
    gap: 16,
    marginBottom: 32,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  switchTextCol: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  rowDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  emptyContainer: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 13,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    gap: 12,
  },
  historyIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  historyContent: {
    flex: 1,
  },
  historyTopLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
    gap: 8,
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  historyBody: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 4,
  },
  historyTime: {
    fontSize: 11,
  },
});
