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
  Linking,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  getDivisionStandings,
  getDivisionRoster,
  StandingRow,
  RosterPlayerResponse,
} from "../../src/api/client";
import { colors } from "../../src/theme/colors";

type TabType = "standings" | "roster";

export default function DivisionStandingsScreen() {
  const { divisionId } = useLocalSearchParams<{ divisionId: string }>();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const [activeTab, setActiveTab] = useState<TabType>("standings");
  const [showLegend, setShowLegend] = useState(false);

  const {
    data: standings,
    isLoading: isStandingsLoading,
    isError: isStandingsError,
    refetch: refetchStandings,
    isRefetching: isStandingsRefetching,
  } = useQuery({
    queryKey: ["standings", divisionId],
    queryFn: () => getDivisionStandings(divisionId || "default"),
  });

  const {
    data: rosterData,
    isLoading: isRosterLoading,
    refetch: refetchRoster,
    isRefetching: isRosterRefetching,
  } = useQuery({
    queryKey: ["roster", divisionId],
    queryFn: () => getDivisionRoster(divisionId || "default"),
    enabled: activeTab === "roster",
  });

  const handleCall = (phone: string | null) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const handleEmail = (email: string | null) => {
    if (email) Linking.openURL(`mailto:${email}`);
  };

  return (
    <View style={styles.container}>
      {/* Header bar */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Division Overview</Text>
          <Text style={styles.subtitle}>Frankfurt Fall Season • Division {divisionId || "Competitive"}</Text>
        </View>
        <TouchableOpacity
          style={styles.reportScoreBtn}
          onPress={() => router.push(`/scores/submit?divisionId=${divisionId || "div-comp-1"}`)}
          activeOpacity={0.8}
        >
          <Text style={styles.reportScoreBtnText}>+ Report Score</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "standings" && styles.tabActive]}
          onPress={() => setActiveTab("standings")}
        >
          <Text style={[styles.tabText, activeTab === "standings" && styles.tabTextActive]}>
            📊 Standings
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "roster" && styles.tabActive]}
          onPress={() => setActiveTab("roster")}
        >
          <Text style={[styles.tabText, activeTab === "roster" && styles.tabTextActive]}>
            👥 Roster & Contacts
          </Text>
        </TouchableOpacity>
      </View>

      {/* Standings Tab */}
      {activeTab === "standings" && (
        <>
          <View style={styles.legendToggleRow}>
            <TouchableOpacity
              style={styles.legendButton}
              onPress={() => setShowLegend(!showLegend)}
              activeOpacity={0.7}
            >
              <Text style={styles.legendButtonText}>
                {showLegend ? "Hide Legend" : "ℹ️ Standings Rules & Legend"}
              </Text>
            </TouchableOpacity>
          </View>

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

          {isStandingsLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : isWide ? (
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
                    <Text style={[styles.td, { width: 70, textAlign: "center" }]}>
                      {row.wins}-{row.losses}
                    </Text>
                    <Text style={[styles.td, { flex: 1.5, textAlign: "right", fontFamily: "monospace" }]}>
                      {row.gamesPctDisplay}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : (
            <FlatList
              data={standings}
              keyExtractor={(item) => item.playerId}
              refreshControl={
                <RefreshControl
                  refreshing={isStandingsRefetching}
                  onRefresh={refetchStandings}
                  tintColor={colors.primary}
                />
              }
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankText}>#{item.rank}</Text>
                    </View>
                    <View style={styles.cardHeaderInfo}>
                      <View style={styles.nameRow}>
                        <Text style={styles.cardPlayerName}>{item.playerName}</Text>
                        {item.isDaytime && <Text style={styles.daytimeFlag}> (d)</Text>}
                      </View>
                      <Text style={styles.cardArea}>{item.homeArea || "Frankfurt"}</Text>
                    </View>
                    <View style={styles.recordBadge}>
                      <Text style={styles.recordText}>
                        {item.wins}-{item.losses}
                      </Text>
                      <Text style={styles.diffText}>{item.playoffIndicator}</Text>
                    </View>
                  </View>
                  <View style={styles.cardBottom}>
                    <Text style={styles.statLabel}>
                      Games %: <Text style={styles.statValue}>{item.gamesPctDisplay}</Text>
                    </Text>
                    {item.isPlayoffEligible && (
                      <View style={styles.playoffBadge}>
                        <Text style={styles.playoffBadgeText}>Playoff Spot</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            />
          )}
        </>
      )}

      {/* Roster & Contacts Tab */}
      {activeTab === "roster" && (
        <View style={{ flex: 1 }}>
          {isRosterLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : rosterData?.gated ? (
            <View style={styles.gatedBox}>
              <Text style={styles.gatedIcon}>🔒</Text>
              <Text style={styles.gatedTitle}>Contact Details Restricted</Text>
              <Text style={styles.gatedMessage}>
                To protect player privacy (GDPR compliant), opponent telephone numbers and email
                addresses are strictly gated and accessible only to verified, active players
                enrolled in this division.
              </Text>
              <TouchableOpacity
                style={styles.signInButton}
                onPress={() => router.push("/(auth)/login")}
              >
                <Text style={styles.signInButtonText}>Sign In to Access Roster</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={rosterData?.players || []}
              keyExtractor={(item) => item.player_id}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={isRosterRefetching}
                  onRefresh={refetchRoster}
                  tintColor={colors.primary}
                />
              }
              renderItem={({ item }) => (
                <View style={styles.rosterCard}>
                  <View style={styles.rosterCardHeader}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.nameRow}>
                        <Text style={styles.cardPlayerName}>{item.display_name}</Text>
                        {item.is_daytime && <Text style={styles.daytimeFlag}> (d)</Text>}
                      </View>
                      <Text style={styles.cardArea}>
                        {item.home_area ? `📍 ${item.home_area}` : "Frankfurt"} • Rating:{" "}
                        {item.rating || "3.5"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.quickScoreBtn}
                      onPress={() =>
                        router.push(
                          `/scores/submit?divisionId=${divisionId || "div-comp-1"}&opponentId=${item.player_id}`
                        )
                      }
                    >
                      <Text style={styles.quickScoreBtnText}>Report Match</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Contact Actions */}
                  <View style={styles.contactRow}>
                    {item.phone ? (
                      <TouchableOpacity
                        style={styles.contactBtn}
                        onPress={() => handleCall(item.phone)}
                      >
                        <Text style={styles.contactBtnText}>📞 {item.phone}</Text>
                      </TouchableOpacity>
                    ) : null}

                    {item.email ? (
                      <TouchableOpacity
                        style={styles.contactBtn}
                        onPress={() => handleEmail(item.email)}
                      >
                        <Text style={styles.contactBtnText}>✉️ {item.email}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              )}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  reportScoreBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  reportScoreBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    paddingVertical: 12,
    marginRight: 20,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary,
  },
  legendToggleRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    alignItems: "flex-end",
  },
  legendButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  legendButtonText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "600",
  },
  legendBox: {
    backgroundColor: colors.surfaceSecondary,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  legendItem: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  legendBold: {
    fontWeight: "700",
    color: colors.text,
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  tableScroll: {
    padding: 16,
  },
  table: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableHeaderRow: {
    backgroundColor: colors.surfaceSecondary,
  },
  th: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
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
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
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
  gatedBox: {
    backgroundColor: colors.surface,
    margin: 20,
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  gatedIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  gatedTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
  },
  gatedMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  signInButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  signInButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  rosterCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  rosterCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  quickScoreBtn: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  quickScoreBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },
  contactRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceSecondary,
    paddingTop: 10,
  },
  contactBtn: {
    backgroundColor: colors.surfaceSecondary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  contactBtnText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: "500",
  },
});
