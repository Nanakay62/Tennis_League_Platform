import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  useWindowDimensions,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getDivisionStandings, StandingRow } from "../../src/api/client";
import { colors } from "../../src/theme/colors";

export default function DivisionStandingsScreen() {
  const { divisionId } = useLocalSearchParams<{ divisionId: string }>();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const [showLegend, setShowLegend] = useState(false);

  const {
    data: standings,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["standings", divisionId],
    queryFn: () => getDivisionStandings(divisionId || "default"),
  });

  return (
    <View style={styles.container}>
      {/* Header bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Division Standings</Text>
          <Text style={styles.subtitle}>Frankfurt Fall Season • Division Standings</Text>
        </View>
        <TouchableOpacity
          style={styles.legendButton}
          onPress={() => setShowLegend(!showLegend)}
          activeOpacity={0.7}
        >
          <Text style={styles.legendButtonText}>
            {showLegend ? "Hide Legend" : "ℹ️ Legend"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Expandable Legend */}
      {showLegend && (
        <View style={styles.legendBox}>
          <Text style={styles.legendItem}>
            <Text style={styles.legendBold}>(d):</Text> Player is available for daytime matches.
          </Text>
          <Text style={styles.legendItem}>
            <Text style={styles.legendBold}>+/-:</Text> Games above/below .500 (wins minus losses).
          </Text>
          <Text style={styles.legendItem}>
            <Text style={styles.legendBold}>Games %:</Text> Total games won divided by total games played.
          </Text>
          <Text style={styles.legendItem}>
            <Text style={styles.legendBold}>Playoffs:</Text> Top qualifying players advance to single-elimination tournament.
          </Text>
        </View>
      )}

      {/* Main standings view */}
      {isWide ? (
        /* Wide screen: Table layout */
        <ScrollView style={styles.tableScroll}>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeaderRow]}>
              <Text style={[styles.th, { width: 50 }]}>#</Text>
              <Text style={[styles.th, { flex: 2 }]}>Player</Text>
              <Text style={[styles.th, { flex: 1.5 }]}>Area</Text>
              <Text style={[styles.th, { width: 70, textAlign: "center" }]}>+/-</Text>
              <Text style={[styles.th, { width: 70, textAlign: "center" }]}>W-L</Text>
              <Text style={[styles.th, { flex: 1.5, textAlign: "right" }]}>Games %</Text>
            </View>

            {standings?.map((row) => (
              <View key={row.playerId} style={styles.tableRow}>
                <Text style={[styles.td, { width: 50, fontWeight: "700" }]}>{row.rank}</Text>
                <View style={[styles.playerCell, { flex: 2 }]}>
                  <Text style={styles.playerName}>{row.playerName}</Text>
                  {row.isDaytime && <Text style={styles.daytimeFlag}> (d)</Text>}
                  {row.isPlayoffEligible && (
                    <Text style={styles.playoffEligibleTag}>Playoffs</Text>
                  )}
                </View>
                <Text style={[styles.td, { flex: 1.5, color: colors.textSecondary }]}>
                  {row.homeArea || "—"}
                </Text>
                <Text style={[styles.td, { width: 70, textAlign: "center", fontWeight: "600" }]}>
                  {row.playoffIndicator}
                </Text>
                <Text style={[styles.td, { width: 70, textAlign: "center", fontWeight: "700" }]}>
                  {row.wins}-{row.losses}
                </Text>
                <Text style={[styles.td, { flex: 1.5, textAlign: "right" }]}>
                  {row.gamesPctDisplay}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        /* Narrow screen: Card layout */
        <FlatList
          data={standings}
          keyExtractor={(item) => item.playerId}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          renderItem={({ item }) => <StandingsCard row={item} />}
        />
      )}
    </View>
  );
}

function StandingsCard({ row }: { row: StandingRow }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.rankBadge}>
          <Text style={styles.rankText}>#{row.rank}</Text>
        </View>
        <View style={styles.cardHeaderInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.cardPlayerName}>{row.playerName}</Text>
            {row.isDaytime && <Text style={styles.daytimeFlag}> (d)</Text>}
          </View>
          <Text style={styles.cardArea}>📍 {row.homeArea || "Frankfurt"}</Text>
        </View>
        <View style={styles.recordBadge}>
          <Text style={styles.recordText}>
            {row.wins}-{row.losses}
          </Text>
          <Text style={styles.diffText}>{row.playoffIndicator}</Text>
        </View>
      </View>

      <View style={styles.cardBottom}>
        <Text style={styles.statLabel}>
          Games: <Text style={styles.statValue}>{row.gamesPctDisplay}</Text>
        </Text>
        {row.isPlayoffEligible && (
          <View style={styles.playoffBadge}>
            <Text style={styles.playoffBadgeText}>✓ Playoff Eligible</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    maxWidth: 960,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  legendButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  legendButtonText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  legendBox: {
    backgroundColor: colors.surfaceSecondary,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  legendItem: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
    lineHeight: 18,
  },
  legendBold: {
    fontWeight: "700",
    color: colors.text,
  },
  // Table styles (desktop)
  tableScroll: {
    flex: 1,
  },
  table: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableHeaderRow: {
    backgroundColor: colors.surfaceSecondary,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  th: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  td: {
    fontSize: 14,
    color: colors.text,
  },
  playerCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  playerName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  daytimeFlag: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
  playoffEligibleTag: {
    backgroundColor: colors.badgeBg,
    color: colors.badgeText,
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  // Card styles (mobile)
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  rankBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  rankText: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },
  cardHeaderInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardPlayerName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  cardArea: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  recordBadge: {
    alignItems: "flex-end",
  },
  recordText: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.primary,
  },
  diffText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  statLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  statValue: {
    fontWeight: "600",
    color: colors.text,
  },
  playoffBadge: {
    backgroundColor: colors.badgeBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  playoffBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.badgeText,
  },
});
