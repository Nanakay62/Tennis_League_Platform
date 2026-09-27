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
  Alert,
  Platform,
  TextInput,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getDivisionStandings,
  getDivisionRoster,
  getDivisionPlayoffs,
  generateDivisionPlayoffs,
  reportPlayoffScore,
  StandingRow,
  RosterPlayerResponse,
  PlayoffBracket,
  PlayoffMatch,
} from "../../src/api/client";
import { colors } from "../../src/theme/colors";

type TabType = "standings" | "roster" | "playoffs";

export default function DivisionDetailScreen() {
  const { divisionId } = useLocalSearchParams<{ divisionId: string }>();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabType>("standings");
  const [showLegend, setShowLegend] = useState(false);

  // Playoff score reporting state
  const [reportingMatch, setReportingMatch] = useState<PlayoffMatch | null>(null);
  const [playoffScoreInput, setPlayoffScoreInput] = useState("6-4, 6-3");
  const [selectedWinnerId, setSelectedWinnerId] = useState<string>("");

  const {
    data: standings,
    isLoading: isStandingsLoading,
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

  const {
    data: playoffsData,
    isLoading: isPlayoffsLoading,
    refetch: refetchPlayoffs,
    isRefetching: isPlayoffsRefetching,
  } = useQuery({
    queryKey: ["playoffs", divisionId],
    queryFn: () => getDivisionPlayoffs(divisionId || "default"),
    enabled: activeTab === "playoffs",
  });

  const generateMutation = useMutation({
    mutationFn: () => generateDivisionPlayoffs(divisionId || "default"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playoffs", divisionId] });
      if (Platform.OS === "web") {
        alert("Playoff bracket generated successfully!");
      } else {
        Alert.alert("Success", "Playoff bracket generated successfully!");
      }
    },
    onError: (err: any) => {
      const msg = err.message || "Could not generate playoffs";
      if (Platform.OS === "web") {
        alert(msg);
      } else {
        Alert.alert("Error", msg);
      }
    },
  });

  const scoreMutation = useMutation({
    mutationFn: ({
      matchId,
      winnerId,
      score,
    }: {
      matchId: string;
      winnerId: string;
      score: string;
    }) => reportPlayoffScore(matchId, winnerId, score),
    onSuccess: () => {
      setReportingMatch(null);
      queryClient.invalidateQueries({ queryKey: ["playoffs", divisionId] });
    },
    onError: (err: any) => {
      alert(err.message || "Failed to record playoff score");
    },
  });

  const handleCall = (phone: string | null) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const handleEmail = (email: string | null) => {
    if (email) Linking.openURL(`mailto:${email}`);
  };

  const championshipBracket = playoffsData?.find((b) => b.bracket_type === "championship") || playoffsData?.[0];

  const getRoundTitle = (roundNum: number, totalRounds: number) => {
    const roundsFromFinal = totalRounds - roundNum;
    if (roundsFromFinal === 0) return "🏆 Championship Final";
    if (roundsFromFinal === 1) return "Semifinals";
    if (roundsFromFinal === 2) return "Quarterfinals";
    return `Round of ${1 << (roundsFromFinal + 1)}`;
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
        <TouchableOpacity
          style={[styles.tab, activeTab === "playoffs" && styles.tabActive]}
          onPress={() => setActiveTab("playoffs")}
        >
          <Text style={[styles.tabText, activeTab === "playoffs" && styles.tabTextActive]}>
            🏆 Playoffs
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
              renderItem={({ item }) => {
                const cardLabel = `Rank ${item.rank}: ${item.playerName}, record ${item.wins} wins and ${item.losses} losses, games percentage ${item.gamesPctDisplay} in ${item.homeArea || "Frankfurt"}`;
                return (
                  <View
                    style={styles.card}
                    accessible={true}
                    accessibilityRole="summary"
                    accessibilityLabel={cardLabel}
                  >
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
                );
              }}
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

      {/* Playoffs Bracket Tab */}
      {activeTab === "playoffs" && (
        <View style={{ flex: 1 }}>
          {isPlayoffsLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : !championshipBracket ? (
            <View style={styles.gatedBox}>
              <Text style={styles.gatedIcon}>🎾</Text>
              <Text style={styles.gatedTitle}>Playoffs Not Yet Generated</Text>
              <Text style={styles.gatedMessage}>
                Division regular season standings determine the single-elimination tournament draw.
                Qualified players advance automatically.
              </Text>
              <TouchableOpacity
                style={[styles.signInButton, generateMutation.isPending && { opacity: 0.6 }]}
                onPress={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.signInButtonText}>Generate Playoff Draw</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16 }}
              refreshControl={
                <RefreshControl
                  refreshing={isPlayoffsRefetching}
                  onRefresh={refetchPlayoffs}
                  tintColor={colors.primary}
                />
              }
            >
              {/* Bracket Summary Header */}
              <View style={styles.bracketSummary}>
                <View>
                  <Text style={styles.bracketTitle}>Single-Elimination Playoff Bracket</Text>
                  <Text style={styles.bracketSub}>
                    {championshipBracket.bracket_size}-Player Draw • Status:{" "}
                    <Text style={{ fontWeight: "700", textTransform: "capitalize" }}>
                      {championshipBracket.status}
                    </Text>
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.regenBtn}
                  onPress={() => generateMutation.mutate()}
                >
                  <Text style={styles.regenBtnText}>Regenerate</Text>
                </TouchableOpacity>
              </View>

              {/* Horizontal Scrollable Bracket Tree */}
              <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.treeScroll}>
                <View style={styles.treeContainer}>
                  {Object.entries(championshipBracket.rounds)
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                    .map(([roundKey, matches]) => {
                      const roundNum = parseInt(roundKey);
                      return (
                        <View key={roundKey} style={styles.roundColumn}>
                          <Text style={styles.roundHeading}>
                            {getRoundTitle(roundNum, championshipBracket.total_rounds)}
                          </Text>

                          <View style={styles.roundMatchesList}>
                            {matches.map((m) => {
                              const p1Won = m.winner && m.player1 && m.winner.id === m.player1.id;
                              const p2Won = m.winner && m.player2 && m.winner.id === m.player2.id;
                              const canReport = !m.winner && m.player1 && m.player2 && !m.is_bye;

                              return (
                                <View key={m.id} style={styles.bracketCard}>
                                  {/* Player 1 */}
                                  <View style={[styles.bPlayerRow, p1Won && styles.bWinnerRow]}>
                                    <Text style={styles.bSeed}>
                                      {m.player1?.seed_number ? `(${m.player1.seed_number})` : ""}
                                    </Text>
                                    <Text
                                      style={[styles.bPlayerName, p1Won && styles.bWinnerText]}
                                      numberOfLines={1}
                                    >
                                      {m.player1 ? m.player1.display_name : "TBD"}
                                    </Text>
                                    {p1Won && <Text style={styles.bCheck}>✓</Text>}
                                  </View>

                                  <View style={styles.bDivider} />

                                  {/* Player 2 */}
                                  <View style={[styles.bPlayerRow, p2Won && styles.bWinnerRow]}>
                                    <Text style={styles.bSeed}>
                                      {m.player2?.seed_number ? `(${m.player2.seed_number})` : ""}
                                    </Text>
                                    <Text
                                      style={[styles.bPlayerName, p2Won && styles.bWinnerText]}
                                      numberOfLines={1}
                                    >
                                      {m.player2 ? m.player2.display_name : m.is_bye ? "BYE" : "TBD"}
                                    </Text>
                                    {p2Won && <Text style={styles.bCheck}>✓</Text>}
                                  </View>

                                  {/* Score line or status */}
                                  <View style={styles.bFooter}>
                                    {m.score_summary ? (
                                      <Text style={styles.bScoreSummary}>{m.score_summary}</Text>
                                    ) : m.deadline ? (
                                      <Text style={styles.bDeadline}>
                                        Deadline: {new Date(m.deadline).toLocaleDateString("de-DE", { month: "short", day: "numeric" })}
                                      </Text>
                                    ) : null}

                                    {canReport && (
                                      <TouchableOpacity
                                        style={styles.bReportBtn}
                                        onPress={() => {
                                          setReportingMatch(m);
                                          setSelectedWinnerId(m.player1?.id || "");
                                        }}
                                      >
                                        <Text style={styles.bReportBtnText}>Report</Text>
                                      </TouchableOpacity>
                                    )}
                                  </View>
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      );
                    })}
                </View>
              </ScrollView>

              {/* Inline Score Reporting Modal / Panel */}
              {reportingMatch && (
                <View style={styles.reportModal}>
                  <Text style={styles.reportModalTitle}>
                    Record Playoff Result: {reportingMatch.player1?.display_name} vs{" "}
                    {reportingMatch.player2?.display_name}
                  </Text>

                  <Text style={styles.label}>Select Winner:</Text>
                  <View style={styles.winnerPickerRow}>
                    <TouchableOpacity
                      style={[
                        styles.pickerBtn,
                        selectedWinnerId === reportingMatch.player1?.id && styles.pickerBtnActive,
                      ]}
                      onPress={() => setSelectedWinnerId(reportingMatch.player1?.id || "")}
                    >
                      <Text
                        style={[
                          styles.pickerBtnText,
                          selectedWinnerId === reportingMatch.player1?.id &&
                            styles.pickerBtnTextActive,
                        ]}
                      >
                        🏆 {reportingMatch.player1?.display_name}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.pickerBtn,
                        selectedWinnerId === reportingMatch.player2?.id && styles.pickerBtnActive,
                      ]}
                      onPress={() => setSelectedWinnerId(reportingMatch.player2?.id || "")}
                    >
                      <Text
                        style={[
                          styles.pickerBtnText,
                          selectedWinnerId === reportingMatch.player2?.id &&
                            styles.pickerBtnTextActive,
                        ]}
                      >
                        🏆 {reportingMatch.player2?.display_name}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.label}>Score Summary (e.g. 6-4, 7-5):</Text>
                  <TextInput
                    style={styles.input}
                    value={playoffScoreInput}
                    onChangeText={setPlayoffScoreInput}
                    placeholder="e.g. 6-3, 6-4"
                  />

                  <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                    <TouchableOpacity
                      style={[styles.signInButton, { flex: 1 }]}
                      onPress={() =>
                        scoreMutation.mutate({
                          matchId: reportingMatch.id,
                          winnerId: selectedWinnerId,
                          score: playoffScoreInput,
                        })
                      }
                      disabled={scoreMutation.isPending}
                    >
                      {scoreMutation.isPending ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.signInButtonText}>Confirm & Advance</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.regenBtn, { paddingHorizontal: 16 }]}
                      onPress={() => setReportingMatch(null)}
                    >
                      <Text style={styles.regenBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
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
    minHeight: 44,
    minWidth: 44,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
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
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginRight: 20,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
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
    alignItems: "center",
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
  bracketSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bracketTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  bracketSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  regenBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  regenBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  treeScroll: {
    paddingBottom: 20,
  },
  treeContainer: {
    flexDirection: "row",
    gap: 20,
  },
  roundColumn: {
    width: 250,
  },
  roundHeading: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  roundMatchesList: {
    gap: 16,
  },
  bracketCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  bPlayerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  bWinnerRow: {
    backgroundColor: "#e8f5e9",
  },
  bSeed: {
    fontSize: 12,
    color: colors.textMuted,
    width: 22,
    fontWeight: "600",
  },
  bPlayerName: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
    fontWeight: "500",
  },
  bWinnerText: {
    fontWeight: "700",
    color: colors.primary,
  },
  bCheck: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "800",
  },
  bDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  bFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceSecondary,
  },
  bScoreSummary: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  bDeadline: {
    fontSize: 11,
    color: colors.textMuted,
  },
  bReportBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  bReportBtnText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  reportModal: {
    backgroundColor: colors.surface,
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  reportModalTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 6,
  },
  winnerPickerRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  pickerBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
  },
  pickerBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pickerBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  pickerBtnTextActive: {
    color: "#fff",
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 14,
    backgroundColor: "#fff",
    marginBottom: 10,
  },
});
