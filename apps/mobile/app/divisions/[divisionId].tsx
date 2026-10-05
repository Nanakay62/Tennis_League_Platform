import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
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
import { Feather } from "@expo/vector-icons";
import {
  getDivisionStandings,
  getDivisionRoster,
  getDivisionPlayoffs,
  generateDivisionPlayoffs,
  reportPlayoffScore,
  PlayoffMatch,
} from "../../src/api/client";
import { useThemeColors } from "../../src/theme/colors";
import {
  AppShell,
  Card,
  Button,
  Badge,
  StandingsTable,
  EmptyState,
} from "../../src/components";

type TabType = "standings" | "roster" | "playoffs";

export default function DivisionDetailScreen() {
  const { colors } = useThemeColors();
  const { divisionId, tab } = useLocalSearchParams<{ divisionId: string; tab?: string }>();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabType>(
    tab === "roster" || tab === "playoffs" ? tab : "standings"
  );

  // Playoff score reporting state
  const [reportingMatch, setReportingMatch] = useState<PlayoffMatch | null>(null);
  const [playoffScoreInput, setPlayoffScoreInput] = useState("6-4, 6-3");
  const [selectedWinnerId, setSelectedWinnerId] = useState<string>("");

  const {
    data: standings,
    isLoading: isStandingsLoading,
  } = useQuery({
    queryKey: ["standings", divisionId],
    queryFn: () => getDivisionStandings(divisionId || "default"),
  });

  const {
    data: rosterData,
    isLoading: isRosterLoading,
    refetch: refetchRoster,
  } = useQuery({
    queryKey: ["roster", divisionId],
    queryFn: () => getDivisionRoster(divisionId || "default"),
    enabled: activeTab === "roster",
  });

  const {
    data: playoffsData,
    isLoading: isPlayoffsLoading,
    refetch: refetchPlayoffs,
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
    if (roundsFromFinal === 0) return "Championship Final";
    if (roundsFromFinal === 1) return "Semifinals";
    if (roundsFromFinal === 2) return "Quarterfinals";
    return `Round of ${1 << (roundsFromFinal + 1)}`;
  };

  return (
    <AppShell title="DIVISION" showBack>
      {/* Header bar */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Division Overview
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Accra Fall Season • Division {divisionId || "Competitive"}
          </Text>
        </View>

        <Button
          variant="primary"
          size="sm"
          href={`/scores/submit?divisionId=${divisionId || "div-accra-comp-1"}`}
          icon="edit-3"
        >
          Report Score
        </Button>
      </View>

      {/* Segmented Control Tabs */}
      <View
        style={[
          styles.tabsContainer,
          { backgroundColor: colors.surfaceMuted, borderColor: colors.borderSubtle },
        ]}
      >
        <Button
          variant={activeTab === "standings" ? "primary" : "ghost"}
          size="sm"
          onPress={() => setActiveTab("standings")}
          icon="bar-chart-2"
          style={styles.tabBtn}
        >
          Standings
        </Button>

        <Button
          variant={activeTab === "roster" ? "primary" : "ghost"}
          size="sm"
          onPress={() => setActiveTab("roster")}
          icon="users"
          style={styles.tabBtn}
        >
          Roster
        </Button>

        <Button
          variant={activeTab === "playoffs" ? "primary" : "ghost"}
          size="sm"
          onPress={() => setActiveTab("playoffs")}
          icon="award"
          style={styles.tabBtn}
        >
          Playoffs
        </Button>
      </View>

      {/* Standings Tab: Reusing StandingsTable from Step 1 */}
      {activeTab === "standings" && (
        <Card title="Division Standings" noPadding>
          <StandingsTable
            standings={standings || []}
            mode="auto"
            showLegend={true}
            loading={isStandingsLoading}
          />
        </Card>
      )}

      {/* Roster & Contacts Tab */}
      {activeTab === "roster" && (
        <View style={styles.tabContent}>
          {isRosterLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : rosterData?.gated ? (
            <Card>
              <EmptyState
                icon="lock"
                title="Contact Details Restricted"
                message="To protect player privacy (GDPR compliant), opponent telephone numbers and email addresses are strictly gated and accessible only to verified, active players enrolled in this division."
                action={{
                  label: "Sign In to Access Roster",
                  href: `/(auth)/login?returnTo=${encodeURIComponent(
                    `/divisions/${divisionId}?tab=roster`
                  )}`,
                }}
              />
            </Card>
          ) : rosterData?.players && rosterData.players.length > 0 ? (
            rosterData.players.map((item) => (
              <Card key={item.player_id} style={styles.playerCard} contentStyle={styles.playerCardContent}>
                <View style={styles.playerHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text
                        style={[styles.playerName, { color: colors.textPrimary }]}
                        numberOfLines={1}
                      >
                        {item.display_name}
                      </Text>
                      {item.is_daytime && (
                        <Text style={[styles.daytimeFlag, { color: colors.textSecondary }]}>
                          (d)
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.playerSub, { color: colors.textSecondary }]}>
                      {item.home_area ? item.home_area : "Accra"} • NTRP {item.rating || "3.5"}
                    </Text>
                  </View>

                  <Button
                    variant="secondary"
                    size="sm"
                    href={`/scores/submit?divisionId=${divisionId || "div-accra-comp-1"}&opponentId=${item.player_id}`}
                    icon="edit-3"
                  >
                    Report
                  </Button>
                </View>

                {(item.phone || item.email) && (
                  <View style={[styles.contactRow, { borderTopColor: colors.borderSubtle }]}>
                    {Boolean(item.phone) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => handleCall(item.phone)}
                        icon="phone"
                        style={styles.contactBtn}
                      >
                        {item.phone}
                      </Button>
                    )}
                    {Boolean(item.email) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => handleEmail(item.email)}
                        icon="mail"
                        style={styles.contactBtn}
                      >
                        {item.email}
                      </Button>
                    )}
                  </View>
                )}

                {(Boolean(item.game_description) || Boolean(item.about_me) || Boolean(item.favorite_link)) && (
                  <View style={{ marginTop: 8, paddingTop: 8, borderTopColor: colors.borderSubtle, borderTopWidth: 1 }}>
                    {Boolean(item.game_description) && (
                      <View style={{ marginBottom: 4 }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textSecondary }}>
                          Style & Tactics:{" "}
                          <Text style={{ fontWeight: "400", color: colors.textPrimary }}>
                            {item.game_description}
                          </Text>
                        </Text>
                      </View>
                    )}
                    {Boolean(item.about_me) && (
                      <Text style={{ fontSize: 12, color: colors.textSecondary, fontStyle: "italic", marginBottom: 4 }}>
                        &quot;{item.about_me}&quot;
                      </Text>
                    )}
                    {Boolean(item.favorite_link) && (
                      <TouchableOpacity
                        style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}
                        onPress={() => Linking.openURL(item.favorite_link!)}
                      >
                        <Feather name="external-link" size={12} color={colors.primary} style={{ marginRight: 4 }} />
                        <Text style={{ fontSize: 11, color: colors.primary, textDecorationLine: "underline" }} numberOfLines={1}>
                          {item.favorite_link}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </Card>
            ))
          ) : (
            <Card>
              <EmptyState
                icon="users"
                title="No Roster Players Found"
                message="Division rosters are finalized on kickoff day with a minimum of 6 verified players."
                action={{
                  label: "Refresh Roster",
                  onPress: () => refetchRoster(),
                }}
              />
            </Card>
          )}
        </View>
      )}

      {/* Playoffs Bracket Tab */}
      {activeTab === "playoffs" && (
        <View style={styles.tabContent}>
          {isPlayoffsLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : !championshipBracket ? (
            <Card>
              <EmptyState
                icon="award"
                title="Playoffs Not Yet Generated"
                message="Division regular season standings determine the single-elimination tournament draw. Top qualifying players advance automatically."
                action={{
                  label: generateMutation.isPending ? "Generating..." : "Generate Playoff Draw",
                  onPress: () => generateMutation.mutate(),
                }}
              />
            </Card>
          ) : (
            <View>
              {/* Bracket Summary Header */}
              <Card style={{ marginBottom: 12 }}>
                <View style={styles.bracketSummary}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bracketTitle, { color: colors.textPrimary }]}>
                      Single-Elimination Tournament
                    </Text>
                    <Text style={[styles.bracketSub, { color: colors.textSecondary }]}>
                      {championshipBracket.bracket_size}-Player Draw • Status: {championshipBracket.status}
                    </Text>
                  </View>
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={() => generateMutation.mutate()}
                    icon="refresh-cw"
                  >
                    Regenerate
                  </Button>
                </View>
              </Card>

              {/* Bracket Horizontal Tree */}
              <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.treeScroll}>
                <View style={styles.treeContainer}>
                  {Object.entries(championshipBracket.rounds)
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                    .map(([roundKey, matches]) => {
                      const roundNum = parseInt(roundKey);
                      return (
                        <View key={roundKey} style={styles.roundColumn}>
                          <Text style={[styles.roundHeading, { color: colors.textPrimary }]}>
                            {getRoundTitle(roundNum, championshipBracket.total_rounds)}
                          </Text>

                          <View style={styles.roundMatchesList}>
                            {matches.map((m) => {
                              const p1Won = m.winner && m.player1 && m.winner.id === m.player1.id;
                              const p2Won = m.winner && m.player2 && m.winner.id === m.player2.id;
                              const canReport = !m.winner && m.player1 && m.player2 && !m.is_bye;

                              return (
                                <View
                                  key={m.id}
                                  style={[
                                    styles.bracketCard,
                                    {
                                      backgroundColor: colors.surface,
                                      borderColor: colors.border,
                                    },
                                  ]}
                                >
                                  {/* Player 1 */}
                                  <View
                                    style={[
                                      styles.bPlayerRow,
                                      p1Won && { backgroundColor: colors.accentSecondary },
                                    ]}
                                  >
                                    <Text style={[styles.bSeed, { color: colors.textSecondary }]}>
                                      {m.player1?.seed_number ? `(${m.player1.seed_number})` : ""}
                                    </Text>
                                    <Text
                                      style={[
                                        styles.bPlayerName,
                                        { color: p1Won ? colors.primary : colors.textPrimary },
                                      ]}
                                      numberOfLines={1}
                                    >
                                      {m.player1 ? m.player1.display_name : "TBD"}
                                    </Text>
                                    {p1Won && (
                                      <Feather name="check" size={14} color={colors.primary} />
                                    )}
                                  </View>

                                  <View style={[styles.bDivider, { backgroundColor: colors.borderSubtle }]} />

                                  {/* Player 2 */}
                                  <View
                                    style={[
                                      styles.bPlayerRow,
                                      p2Won && { backgroundColor: colors.accentSecondary },
                                    ]}
                                  >
                                    <Text style={[styles.bSeed, { color: colors.textSecondary }]}>
                                      {m.player2?.seed_number ? `(${m.player2.seed_number})` : ""}
                                    </Text>
                                    <Text
                                      style={[
                                        styles.bPlayerName,
                                        { color: p2Won ? colors.primary : colors.textPrimary },
                                      ]}
                                      numberOfLines={1}
                                    >
                                      {m.player2 ? m.player2.display_name : m.is_bye ? "BYE" : "TBD"}
                                    </Text>
                                    {p2Won && (
                                      <Feather name="check" size={14} color={colors.primary} />
                                    )}
                                  </View>

                                  {/* Footer: score or report CTA */}
                                  <View style={[styles.bFooter, { borderTopColor: colors.borderSubtle }]}>
                                    {m.score_summary ? (
                                      <Text style={[styles.bScoreSummary, { color: colors.textPrimary }]}>
                                        {m.score_summary}
                                      </Text>
                                    ) : m.deadline ? (
                                      <Text style={[styles.bDeadline, { color: colors.textSecondary }]}>
                                        Deadline: {new Date(m.deadline).toLocaleDateString("en-GH", { month: "short", day: "numeric" })}
                                      </Text>
                                    ) : null}

                                    {canReport && (
                                      <Button
                                        variant="primary"
                                        size="sm"
                                        onPress={() => {
                                          setReportingMatch(m);
                                          setSelectedWinnerId(m.player1?.id || "");
                                        }}
                                      >
                                        Report
                                      </Button>
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

              {/* Inline Score Reporting Modal */}
              {reportingMatch && (
                <Card title="Record Playoff Result" style={{ marginTop: 16 }}>
                  <Text style={[styles.modalOpponents, { color: colors.textPrimary }]}>
                    {reportingMatch.player1?.display_name} vs {reportingMatch.player2?.display_name}
                  </Text>

                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Select Winner:</Text>
                  <View style={styles.winnerPickerRow}>
                    <Button
                      variant={selectedWinnerId === reportingMatch.player1?.id ? "primary" : "secondary"}
                      size="sm"
                      onPress={() => setSelectedWinnerId(reportingMatch.player1?.id || "")}
                      style={{ flex: 1 }}
                    >
                      {reportingMatch.player1?.display_name}
                    </Button>
                    <Button
                      variant={selectedWinnerId === reportingMatch.player2?.id ? "primary" : "secondary"}
                      size="sm"
                      onPress={() => setSelectedWinnerId(reportingMatch.player2?.id || "")}
                      style={{ flex: 1 }}
                    >
                      {reportingMatch.player2?.display_name}
                    </Button>
                  </View>

                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    Score Summary (e.g. 6-4, 7-5):
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.surfaceMuted,
                        color: colors.textPrimary,
                        borderColor: colors.border,
                      },
                    ]}
                    value={playoffScoreInput}
                    onChangeText={setPlayoffScoreInput}
                    placeholder="e.g. 6-3, 6-4"
                    placeholderTextColor={colors.textMuted}
                  />

                  <View style={styles.modalActionsRow}>
                    <Button
                      variant="primary"
                      size="md"
                      onPress={() =>
                        scoreMutation.mutate({
                          matchId: reportingMatch.id,
                          winnerId: selectedWinnerId,
                          score: playoffScoreInput,
                        })
                      }
                      loading={scoreMutation.isPending}
                      style={{ flex: 1 }}
                    >
                      Confirm & Advance
                    </Button>
                    <Button
                      variant="secondary"
                      size="md"
                      onPress={() => setReportingMatch(null)}
                    >
                      Cancel
                    </Button>
                  </View>
                </Card>
              )}
            </View>
          )}
        </View>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 10,
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
  tabsContainer: {
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
  tabContent: {
    gap: 12,
  },
  centerBox: {
    padding: 48,
    alignItems: "center",
    justifyContent: "center",
  },

  // Roster cards
  playerCard: {
    marginBottom: 10,
  },
  playerCardContent: {
    padding: 14,
  },
  playerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  playerName: {
    fontSize: 15,
    fontWeight: "700",
  },
  daytimeFlag: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  playerSub: {
    fontSize: 12,
    marginTop: 2,
  },
  contactRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  contactBtn: {
    minHeight: 32,
    paddingHorizontal: 10,
  },

  // Playoff Bracket
  bracketSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bracketTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  bracketSub: {
    fontSize: 12,
    marginTop: 2,
  },
  treeScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  treeContainer: {
    flexDirection: "row",
    gap: 16,
    paddingBottom: 16,
  },
  roundColumn: {
    width: 250,
  },
  roundHeading: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  roundMatchesList: {
    gap: 12,
  },
  bracketCard: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  bPlayerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  bSeed: {
    fontSize: 11,
    width: 24,
    fontWeight: "600",
  },
  bPlayerName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  bDivider: {
    height: 1,
  },
  bFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderTopWidth: 1,
  },
  bScoreSummary: {
    fontSize: 12,
    fontWeight: "700",
  },
  bDeadline: {
    fontSize: 11,
  },

  // Playoff score modal
  modalOpponents: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 10,
  },
  winnerPickerRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  input: {
    height: 42,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  modalActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
});
