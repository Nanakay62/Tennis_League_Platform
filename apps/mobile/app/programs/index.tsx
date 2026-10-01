import React, { useState } from "react";
import { View, Text, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { getPrograms } from "../../src/api/client";
import { useThemeColors } from "../../src/theme/colors";
import { AppShell, Card, Badge, Button, EmptyState } from "../../src/components";

type TabMode = "browse" | "mine";

export default function ProgramsScreen() {
  const { colors } = useThemeColors();
  const [activeTab, setActiveTab] = useState<TabMode>("browse");

  const { data: programs, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["programs"],
    queryFn: getPrograms,
  });

  return (
    <AppShell title="PROGRAMS">
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Seasons & Programs
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Join an upcoming flex singles season or view divisions.
        </Text>
      </View>

      {/* Tabs: Mine / Browse (Handbook §1.2, §2.3) */}
      <View
        style={[
          styles.tabsRow,
          { backgroundColor: colors.surfaceMuted, borderColor: colors.borderSubtle },
        ]}
      >
        <Button
          variant={activeTab === "browse" ? "primary" : "ghost"}
          size="sm"
          onPress={() => setActiveTab("browse")}
          style={styles.tabBtn}
        >
          Browse All
        </Button>
        <Button
          variant={activeTab === "mine" ? "primary" : "ghost"}
          size="sm"
          onPress={() => setActiveTab("mine")}
          style={styles.tabBtn}
        >
          My Programs
        </Button>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : activeTab === "mine" ? (
        <Card style={styles.contentCard}>
          <EmptyState
            icon="award"
            title="No Active Enrollments"
            message="You are not currently enrolled in any active seasons. Browse available divisions to sign up."
            action={{
              label: "Browse Seasons",
              onPress: () => setActiveTab("browse"),
            }}
          />
        </Card>
      ) : programs && programs.length > 0 ? (
        programs.map((item) => (
          <Card
            key={item.id}
            style={styles.programCard}
            contentStyle={styles.cardContent}
          >
            <View style={styles.cardHeaderRow}>
              <Badge
                label={item.status}
                variant={item.status.includes("Open") ? "success" : "neutral"}
                icon="calendar"
              />
              <Text style={[styles.priceTag, { color: colors.primary }]}>
                {item.currency === "EUR" ? "€" : "GH₵ "}{(item.priceCents / 100).toFixed(2)}
              </Text>
            </View>

            <Text
              style={[styles.programName, { color: colors.textPrimary }]}
              numberOfLines={2}
            >
              {item.name}
            </Text>

            <View style={styles.metaRow}>
              <Feather name="clock" size={13} color={colors.textSecondary} style={{ marginRight: 6 }} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {item.startDate} to {item.endDate}
              </Text>
            </View>

            <View style={[styles.cardFooter, { borderTopColor: colors.borderSubtle }]}>
              <Text style={[styles.typeText, { color: colors.textSecondary }]}>
                Flex singles • 6+ verified partners guaranteed
              </Text>

              <Button
                variant="primary"
                size="sm"
                href={`/programs/${item.id}`}
                iconRight="arrow-right"
              >
                Select Division
              </Button>
            </View>
          </Card>
        ))
      ) : (
        <Card style={styles.contentCard}>
          <EmptyState
            icon="calendar"
            title="No Programs Available"
            message="There are currently no active programs open for registration. Check back soon for upcoming season announcements."
            action={{
              label: "Refresh",
              onPress: () => refetch(),
            }}
          />
        </Card>
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
  tabsRow: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    gap: 6,
  },
  tabBtn: {
    flex: 1,
  },
  loadingContainer: {
    padding: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  contentCard: {
    paddingVertical: 12,
  },
  programCard: {
    marginBottom: 14,
  },
  cardContent: {
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  priceTag: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  programName: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  metaText: {
    fontSize: 13,
    fontWeight: "500",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 1,
    flexWrap: "wrap",
    gap: 10,
  },
  typeText: {
    fontSize: 12,
    fontWeight: "500",
    flexShrink: 1,
  },
});
