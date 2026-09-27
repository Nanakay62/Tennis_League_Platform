import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getProgramDivisions } from "../../src/api/client";
import { useThemeColors } from "../../src/theme/colors";
import { AppShell, Card, ListRow, EmptyState } from "../../src/components";

export default function ProgramDivisionsScreen() {
  const { colors } = useThemeColors();
  const { programId } = useLocalSearchParams<{ programId: string }>();

  const { data: divisions, isLoading, refetch } = useQuery({
    queryKey: ["divisions", programId],
    queryFn: () => getProgramDivisions(programId || "default"),
  });

  return (
    <AppShell title="SELECT DIVISION" showBack>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Skill Divisions
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Select a division to view current standings, schedules, and active rosters.
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : divisions && divisions.length > 0 ? (
        <Card title="Available Divisions" noPadding>
          {divisions.map((item, idx) => (
            <ListRow
              key={item.id}
              icon="shield"
              title={item.name}
              subtitle={`NTRP ${item.ratingBand} • ${item.playersCount} Enrolled Players`}
              badge={`NTRP ${item.ratingBand}`}
              href={`/divisions/${item.id}`}
              isLast={idx === divisions.length - 1}
            />
          ))}
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon="shield"
            title="No Divisions Found"
            message="No active divisions were found for this program. Divisions are created on kickoff day based on enrolled players."
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
  loadingContainer: {
    padding: 48,
    alignItems: "center",
    justifyContent: "center",
  },
});
