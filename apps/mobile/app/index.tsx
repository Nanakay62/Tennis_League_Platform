import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { fetchCurrentUser, UserSession } from "../src/lib/auth";
import {
  getDivisionStandings,
  getDivisionRoster,
  getLatestScoresFeed,
  StandingRow,
  RosterPlayerResponse,
  LatestScoreFeedItem,
} from "../src/api/client";

export default function HomeScreen() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [roster, setRoster] = useState<RosterPlayerResponse[]>([]);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [recentScores, setRecentScores] = useState<LatestScoreFeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      try {
        const [userData, rosterRes, standingsData, scoresData] = await Promise.all([
          fetchCurrentUser(),
          getDivisionRoster("div-comp-1"),
          getDivisionStandings("div-comp-1"),
          getLatestScoresFeed(),
        ]);

        setUser(userData);
        setRoster(rosterRes.players || []);
        setStandings(standingsData || []);
        setRecentScores((scoresData || []).slice(0, 3));
      } catch (err) {
        console.warn("Failed to load dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  // Determine opponent for next match
  const opponent =
    roster.find((p) => !user || p.player_id !== user.id) ||
    roster[1] ||
    roster[0] ||
    null;

  // Show top 3 rows for compact standings
  const topStandings = standings.slice(0, 3);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* 1. Slim Header */}
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <View style={styles.brandMark} />
          <Text style={styles.brandTitle}>FRANKFURT TENNIS</Text>
        </View>

        <View style={styles.headerNav}>
          <Link href="/programs" asChild>
            <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.headerNavLink}>Programs</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/courts" asChild>
            <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.headerNavLink}>Courts</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/account" asChild>
            <TouchableOpacity style={styles.avatarButton} activeOpacity={0.8}>
              {user?.displayName ? (
                <Text style={styles.avatarText}>
                  {user.displayName.charAt(0).toUpperCase()}
                </Text>
              ) : (
                <Feather name="user" size={16} color="#44403c" />
              )}
            </TouchableOpacity>
          </Link>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 2. Hero Card: Your Next Match */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeaderRow}>
            <Text style={styles.heroSectionLabel}>NEXT MATCH • ROUND 3</Text>
            <View style={styles.heroStatusDot} />
          </View>

          <Text style={styles.heroOpponentName}>
            vs. {opponent ? opponent.display_name : "Maximilian Weber"}
          </Text>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaItem}>
              <Feather name="calendar" size={14} color="#78716c" style={styles.heroMetaIcon} />
              <Text style={styles.heroMetaText}>Thursday, Oct 8 • 18:00 CEST</Text>
            </View>
            <View style={styles.heroMetaItem}>
              <Feather name="map-pin" size={14} color="#78716c" style={styles.heroMetaIcon} />
              <Text style={styles.heroMetaText}>TC Palmengarten (Clay Court 4)</Text>
            </View>
          </View>

          <View style={styles.heroActionsRow}>
            <Link href="/divisions/div-comp-1" asChild>
              <TouchableOpacity style={styles.primaryActionButton} activeOpacity={0.85}>
                <Text style={styles.primaryActionButtonText}>Confirm Availability</Text>
              </TouchableOpacity>
            </Link>

            <Link href="/scores/submit" asChild>
              <TouchableOpacity style={styles.secondaryActionButton} activeOpacity={0.85}>
                <Text style={styles.secondaryActionButtonText}>Report Score</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>

        {/* 3. Two Columns: Compact Standings Preview + Dense Quick Actions */}
        <View style={styles.columnsContainer}>
          {/* Left Column: Compact Standings */}
          <View style={styles.standingsColumn}>
            <View style={styles.columnHeaderRow}>
              <Text style={styles.columnTitle}>Competitive 3.5 Division</Text>
              <Link href="/divisions/div-comp-1" asChild>
                <TouchableOpacity>
                  <Text style={styles.columnLink}>Full Table →</Text>
                </TouchableOpacity>
              </Link>
            </View>

            <View style={styles.standingsCard}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, styles.rankCol]}>#</Text>
                <Text style={[styles.tableHeaderCell, styles.playerCol]}>Player</Text>
                <Text style={[styles.tableHeaderCell, styles.recordCol]}>W - L</Text>
                <Text style={[styles.tableHeaderCell, styles.pctCol]}>Win %</Text>
              </View>

              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#204b39" />
                </View>
              ) : topStandings.length > 0 ? (
                topStandings.map((row, idx) => (
                  <View
                    key={row.playerId || idx}
                    style={[
                      styles.tableRow,
                      idx === topStandings.length - 1 && styles.tableRowLast,
                    ]}
                  >
                    <Text style={[styles.tableCellRank, styles.rankCol]}>
                      {row.rank}
                    </Text>
                    <Text style={[styles.tableCellName, styles.playerCol]} numberOfLines={1}>
                      {row.playerName}
                    </Text>
                    <Text style={[styles.tableCellRecord, styles.recordCol]}>
                      {row.wins} - {row.losses}
                    </Text>
                    <Text style={[styles.tableCellPct, styles.pctCol]}>
                      {(row.gamesPct * 100).toFixed(0)}%
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No standing data available.</Text>
              )}

              <Link href="/divisions/div-comp-1" asChild>
                <TouchableOpacity style={styles.cardFooterLink} activeOpacity={0.8}>
                  <Text style={styles.cardFooterLinkText}>View full division standings</Text>
                  <Feather name="arrow-right" size={13} color="#204b39" />
                </TouchableOpacity>
              </Link>
            </View>
          </View>

          {/* Right Column: Dense Quick Actions List Rows */}
          <View style={styles.actionsColumn}>
            <View style={styles.columnHeaderRow}>
              <Text style={styles.columnTitle}>Quick Actions</Text>
            </View>

            <View style={styles.actionList}>
              <Link href="/scores/submit" asChild>
                <TouchableOpacity style={styles.actionListRow} activeOpacity={0.7}>
                  <View style={styles.actionRowIconContainer}>
                    <Feather name="edit-3" size={16} color="#204b39" />
                  </View>
                  <View style={styles.actionRowContent}>
                    <Text style={styles.actionRowTitle}>Report Match Score</Text>
                    <Text style={styles.actionRowSubtitle}>Submit sets for confirmation</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color="#a8a29e" />
                </TouchableOpacity>
              </Link>

              <Link href="/partners" asChild>
                <TouchableOpacity style={styles.actionListRow} activeOpacity={0.7}>
                  <View style={styles.actionRowIconContainer}>
                    <Feather name="users" size={16} color="#204b39" />
                  </View>
                  <View style={styles.actionRowContent}>
                    <Text style={styles.actionRowTitle}>Practice Partners</Text>
                    <Text style={styles.actionRowSubtitle}>Find local players by NTRP</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color="#a8a29e" />
                </TouchableOpacity>
              </Link>

              <Link href="/courts" asChild>
                <TouchableOpacity style={styles.actionListRow} activeOpacity={0.7}>
                  <View style={styles.actionRowIconContainer}>
                    <Feather name="map-pin" size={16} color="#204b39" />
                  </View>
                  <View style={styles.actionRowContent}>
                    <Text style={styles.actionRowTitle}>Frankfurt Courts</Text>
                    <Text style={styles.actionRowSubtitle}>Directory, surfaces & booking</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color="#a8a29e" />
                </TouchableOpacity>
              </Link>

              <Link href="/community/poty" asChild>
                <TouchableOpacity style={styles.actionListRow} activeOpacity={0.7}>
                  <View style={styles.actionRowIconContainer}>
                    <Feather name="award" size={16} color="#204b39" />
                  </View>
                  <View style={styles.actionRowContent}>
                    <Text style={styles.actionRowTitle}>Player of the Year</Text>
                    <Text style={styles.actionRowSubtitle}>Leaderboard & awards</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color="#a8a29e" />
                </TouchableOpacity>
              </Link>

              <Link href="/programs" asChild>
                <TouchableOpacity
                  style={StyleSheet.flatten([styles.actionListRow, styles.actionListRowLast])}
                  activeOpacity={0.7}
                >
                  <View style={styles.actionRowIconContainer}>
                    <Feather name="calendar" size={16} color="#204b39" />
                  </View>
                  <View style={styles.actionRowContent}>
                    <Text style={styles.actionRowTitle}>Browse Programs</Text>
                    <Text style={styles.actionRowSubtitle}>Fall Season 2026 divisions</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color="#a8a29e" />
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </View>

        {/* 4. Slim, Lower-Emphasis Banner Row for Join / Enrollment (Shown for guest/not-yet-enrolled users) */}
        {!user && (
          <View style={styles.enrollmentBanner}>
            <View style={styles.enrollmentBannerTextCol}>
              <View style={styles.bannerTagRow}>
                <Feather name="calendar" size={13} color="#204b39" style={{ marginRight: 6 }} />
                <Text style={styles.enrollmentBannerHeadline}>
                  Fall Season 2026 Open for Registration
                </Text>
              </View>
              <Text style={styles.enrollmentBannerSub}>
                Join competitive flex singles across Frankfurt courts • €34.95
              </Text>
            </View>

            <Link href="/join" asChild>
              <TouchableOpacity style={styles.enrollmentBannerBtn} activeOpacity={0.8}>
                <Text style={styles.enrollmentBannerBtnText}>Join Today</Text>
                <Feather name="arrow-right" size={13} color="#ffffff" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </Link>
          </View>
        )}

        {/* 5. Recent Results List */}
        <View style={styles.resultsSection}>
          <View style={styles.columnHeaderRow}>
            <Text style={styles.columnTitle}>Recent League Results</Text>
            <Link href="/scores" asChild>
              <TouchableOpacity>
                <Text style={styles.columnLink}>View all results →</Text>
              </TouchableOpacity>
            </Link>
          </View>

          <View style={styles.resultsCard}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#204b39" />
              </View>
            ) : recentScores.length > 0 ? (
              recentScores.map((match, idx) => (
                <View
                  key={match.id || idx}
                  style={[
                    styles.resultRow,
                    idx === recentScores.length - 1 && styles.resultRowLast,
                  ]}
                >
                  <View style={styles.resultMainCol}>
                    <Text style={styles.resultMatchup}>
                      <Text style={styles.resultWinner}>{match.winner_name}</Text>
                      <Text style={styles.resultVs}> def. </Text>
                      <Text style={styles.resultLoser}>{match.loser_name}</Text>
                    </Text>
                    <Text style={styles.resultDivision}>{match.division_name}</Text>
                  </View>

                  <View style={styles.resultScoreCol}>
                    <Text style={styles.resultScore}>{match.score_line}</Text>
                    <Text style={styles.resultStatus}>Confirmed</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No recent scores recorded.</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8f7f4",
  },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    backgroundColor: "#f8f7f4",
    borderBottomWidth: 1,
    borderBottomColor: "#e6e3dc",
  },
  headerBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandMark: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#204b39",
  },
  brandTitle: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "#1c1917",
  },
  headerNav: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  headerNavLink: {
    fontSize: 13,
    fontWeight: "600",
    color: "#57534e",
  },
  avatarButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e7e5e0",
    borderWidth: 1,
    borderColor: "#d6d3cd",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#204b39",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    maxWidth: 900,
    width: "100%",
    alignSelf: "center",
  },

  // Hero Card
  heroCard: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e6e3dc",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  heroSectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#78716c",
  },
  heroStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#204b39",
  },
  heroOpponentName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1c1917",
    marginBottom: 12,
  },
  heroMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 18,
  },
  heroMetaItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  heroMetaIcon: {
    marginRight: 6,
  },
  heroMetaText: {
    fontSize: 13,
    color: "#57534e",
    fontWeight: "500",
  },
  heroActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  primaryActionButton: {
    backgroundColor: "#204b39",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryActionButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  secondaryActionButton: {
    backgroundColor: "#f4f3ef",
    borderWidth: 1,
    borderColor: "#e1ded7",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionButtonText: {
    color: "#292524",
    fontSize: 13,
    fontWeight: "600",
  },

  // Two Column Layout
  columnsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 20,
  },
  standingsColumn: {
    flex: 1,
    minWidth: 320,
  },
  actionsColumn: {
    flex: 1,
    minWidth: 320,
  },
  columnHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  columnTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1c1917",
    letterSpacing: -0.2,
  },
  columnLink: {
    fontSize: 12,
    fontWeight: "600",
    color: "#204b39",
  },

  // Standings Card
  standingsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e6e3dc",
    overflow: "hidden",
  },
  tableHeaderRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#f7f6f2",
    borderBottomWidth: 1,
    borderBottomColor: "#edeae3",
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: "700",
    color: "#78716c",
  },
  rankCol: {
    width: 24,
    textAlign: "center",
  },
  playerCol: {
    flex: 1,
    paddingHorizontal: 8,
  },
  recordCol: {
    width: 48,
    textAlign: "center",
  },
  pctCol: {
    width: 48,
    textAlign: "right",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f2ee",
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableCellRank: {
    fontSize: 13,
    fontWeight: "700",
    color: "#78716c",
  },
  tableCellName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1c1917",
  },
  tableCellRecord: {
    fontSize: 13,
    fontWeight: "500",
    color: "#44403c",
  },
  tableCellPct: {
    fontSize: 12,
    fontWeight: "600",
    color: "#204b39",
  },
  cardFooterLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#faf9f6",
    borderTopWidth: 1,
    borderTopColor: "#edeae3",
  },
  cardFooterLinkText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#204b39",
  },

  // Dense Action List
  actionList: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e6e3dc",
    overflow: "hidden",
  },
  actionListRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f2ee",
  },
  actionListRowLast: {
    borderBottomWidth: 0,
  },
  actionRowIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "#edf3ef",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  actionRowContent: {
    flex: 1,
  },
  actionRowTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1c1917",
    marginBottom: 2,
  },
  actionRowSubtitle: {
    fontSize: 12,
    color: "#78716c",
  },

  // Slim Enrollment Banner (Low Emphasis)
  enrollmentBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f4f3ee",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e4e1d9",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 12,
  },
  enrollmentBannerTextCol: {
    flex: 1,
    minWidth: 260,
  },
  bannerTagRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  enrollmentBannerHeadline: {
    fontSize: 13,
    fontWeight: "700",
    color: "#204b39",
  },
  enrollmentBannerSub: {
    fontSize: 12,
    color: "#57534e",
  },
  enrollmentBannerBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#204b39",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  enrollmentBannerBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },

  // Recent Results
  resultsSection: {
    marginBottom: 20,
  },
  resultsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e6e3dc",
    overflow: "hidden",
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f2ee",
  },
  resultRowLast: {
    borderBottomWidth: 0,
  },
  resultMainCol: {
    flex: 1,
    paddingRight: 12,
  },
  resultMatchup: {
    fontSize: 13,
    marginBottom: 2,
  },
  resultWinner: {
    fontWeight: "700",
    color: "#1c1917",
  },
  resultVs: {
    color: "#a8a29e",
    fontWeight: "400",
  },
  resultLoser: {
    color: "#57534e",
    fontWeight: "500",
  },
  resultDivision: {
    fontSize: 11,
    color: "#78716c",
  },
  resultScoreCol: {
    alignItems: "flex-end",
  },
  resultScore: {
    fontSize: 13,
    fontWeight: "700",
    color: "#204b39",
    marginBottom: 2,
  },
  resultStatus: {
    fontSize: 10,
    fontWeight: "600",
    color: "#78716c",
    textTransform: "uppercase",
  },
  loadingContainer: {
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    padding: 16,
    fontSize: 12,
    color: "#78716c",
    textAlign: "center",
  },
});
