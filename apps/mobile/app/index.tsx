import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
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
import { useThemeColors } from "../src/theme/colors";
import {
  AppShell,
  Card,
  MetricCard,
  ListRow,
  Button,
  Badge,
  StandingsTable,
} from "../src/components";

export default function HomeScreen() {
  const { colors } = useThemeColors();
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

  // Top 3 for compact preview
  const topStandings = standings.slice(0, 3);

  // Compute player stats for Season Metrics (from standings)
  const myStanding = user
    ? standings.find((s) => s.playerId === user.id) || standings[0]
    : standings[0];

  const currentRank = myStanding ? `#${myStanding.rank}` : "#2";
  const currentRecord = myStanding ? `${myStanding.wins} - ${myStanding.losses}` : "4 - 2";
  const currentPct = myStanding ? `${(myStanding.gamesPct * 100).toFixed(0)}%` : "58%";
  const winsCount = myStanding ? myStanding.wins : 4;

  return (
    <AppShell>
      {/* Greeting Header */}
      <View style={styles.greetingSection}>
        <View style={styles.greetingCol}>
          <Text style={[styles.greetingHeadline, { color: colors.textPrimary }]}>
            {user?.displayName ? `Welcome back, ${user.displayName}` : "Frankfurt Tennis League"}
          </Text>
          <Text style={[styles.greetingSub, { color: colors.textSecondary }]}>
            Competitive 3.5 • Fall Season 2026
          </Text>
        </View>
        <View style={styles.marketBadge}>
          <Feather name="map-pin" size={12} color={colors.textSecondary} style={{ marginRight: 4 }} />
          <Text style={[styles.marketText, { color: colors.textSecondary }]}>
            Frankfurt, Germany
          </Text>
        </View>
      </View>

      {/* 1. Hero Card: Your Next Match (Flat surface, no stock photography - Constraint #1) */}
      <Card
        style={[
          styles.heroCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.heroTopRow}>
          <Badge label="NEXT MATCH • ROUND 3" variant="accent" icon="calendar" />
          <View style={[styles.heroLiveDot, { backgroundColor: colors.success }]} />
        </View>

        <Text
          style={[styles.heroOpponentTitle, { color: colors.textPrimary }]}
          numberOfLines={2}
        >
          vs. {opponent ? opponent.display_name : "Maximilian Weber"}
        </Text>

        {/* Match details with flex wrap for realistic longer data (Constraint #2) */}
        <View style={styles.heroMetaWrap}>
          <View style={styles.heroMetaItem}>
            <Feather name="clock" size={13} color={colors.textSecondary} style={{ marginRight: 6 }} />
            <Text style={[styles.heroMetaText, { color: colors.textSecondary }]}>
              Thursday, Oct 8 • 18:00 CEST
            </Text>
          </View>
          <View style={styles.heroMetaItem}>
            <Feather name="map-pin" size={13} color={colors.textSecondary} style={{ marginRight: 6 }} />
            <Text style={[styles.heroMetaText, { color: colors.textSecondary }]}>
              TC Palmengarten (Clay Court 4)
            </Text>
          </View>
        </View>

        {/* Primary and secondary action buttons */}
        <View style={styles.heroActionsRow}>
          <Button
            variant="primary"
            size="md"
            href="/divisions/div-comp-1"
            icon="check-circle"
            style={styles.heroActionBtn}
          >
            Confirm Availability
          </Button>

          <Button
            variant="secondary"
            size="md"
            href="/scores/submit"
            icon="edit-3"
            style={styles.heroActionBtn}
          >
            Report Score
          </Button>
        </View>
      </Card>

      {/* 2. Your Season Stat Metrics */}
      <View style={styles.metricsRow}>
        <MetricCard label="Position" value={currentRank} />
        <MetricCard label="Record" value={currentRecord} />
        <MetricCard label="Games Won" value={currentPct} />
        <MetricCard
          label="Wins Needed"
          value={`${winsCount} / 5`}
          progress={{
            current: winsCount,
            total: 5,
            label: `${Math.max(5 - winsCount, 0)} wins to qualify`,
          }}
        />
      </View>

      {/* 3. Two Columns: Compact Standings Preview + Dense Quick Actions */}
      <View style={styles.columnsContainer}>
        {/* Left Column: Compact Standings */}
        <View style={styles.columnLeft}>
          <Card
            title="Competitive 3.5 Division"
            actionLink={{ label: "Full Table →", href: "/divisions/div-comp-1" }}
            noPadding
          >
            <StandingsTable
              standings={topStandings}
              currentUserPlayerId={user?.id}
              mode="auto"
              loading={loading}
              divisionId="div-comp-1"
              showLegend={false}
            />
          </Card>
        </View>

        {/* Right Column: Dense Quick Actions */}
        <View style={styles.columnRight}>
          <Card title="Quick Actions" noPadding>
            <ListRow
              icon="edit-3"
              title="Report Match Score"
              subtitle="Submit sets for opponent confirmation"
              href="/scores/submit"
            />
            <ListRow
              icon="users"
              title="Practice Partners"
              subtitle="Find local players by NTRP rating"
              href="/partners"
            />
            <ListRow
              icon="map-pin"
              title="Frankfurt Courts"
              subtitle="Directory, surfaces & booking"
              href="/courts"
            />
            <ListRow
              icon="award"
              title="Player of the Year"
              subtitle="Leaderboard & community awards"
              href="/community/poty"
            />
            <ListRow
              icon="calendar"
              title="Browse Programs"
              subtitle="Fall Season 2026 flex divisions"
              href="/programs"
              isLast
            />
          </Card>
        </View>
      </View>

      {/* 4. Slim, Lower-Emphasis Banner Row for Join Today (Shown only to guest/un-enrolled users) */}
      {!user && (
        <View
          style={[
            styles.enrollmentBanner,
            {
              backgroundColor: colors.surfaceSubtle,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.enrollmentTextCol}>
            <View style={styles.bannerTagRow}>
              <Feather name="calendar" size={13} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.enrollmentHeadline, { color: colors.primary }]}>
                Fall Season 2026 Open for Registration
              </Text>
            </View>
            <Text style={[styles.enrollmentSub, { color: colors.textSecondary }]}>
              Join competitive flex singles across Frankfurt courts • €34.95
            </Text>
          </View>

          <Button
            variant="primary"
            size="sm"
            href="/join"
            iconRight="arrow-right"
          >
            Join Today
          </Button>
        </View>
      )}

      {/* 5. Recent League Results (Fixed layout preventing collision with longer names - Constraint #2) */}
      <Card
        title="Recent League Results"
        actionLink={{ label: "View all results →", href: "/scores" }}
        noPadding
      >
        {loading ? (
          <View style={styles.loadingFeed}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : recentScores.length > 0 ? (
          recentScores.map((match, idx) => {
            const isLast = idx === recentScores.length - 1;

            return (
              <View
                key={match.id || idx}
                style={[
                  styles.resultRow,
                  !isLast && { borderBottomColor: colors.borderSubtle, borderBottomWidth: 1 },
                ]}
              >
                <View style={styles.resultMatchupCol}>
                  <Text
                    style={[styles.resultMatchupText, { color: colors.textPrimary }]}
                    numberOfLines={2}
                  >
                    <Text style={styles.resultWinner}>{match.winner_name}</Text>
                    <Text style={[styles.resultVs, { color: colors.textMuted }]}> def. </Text>
                    <Text style={styles.resultLoser}>{match.loser_name}</Text>
                  </Text>
                  <Text style={[styles.resultDivisionText, { color: colors.textSecondary }]}>
                    {match.division_name}
                  </Text>
                </View>

                <View style={styles.resultScoreCol}>
                  <Text
                    style={[styles.resultScoreLine, { color: colors.textPrimary }]}
                    numberOfLines={1}
                  >
                    {match.score_line}
                  </Text>
                  <Badge label="Confirmed" variant="success" size="sm" />
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.loadingFeed}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No recent scores recorded.
            </Text>
          </View>
        )}
      </Card>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  greetingSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  greetingCol: {
    flex: 1,
    minWidth: 240,
  },
  greetingHeadline: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  greetingSub: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: "500",
  },
  marketBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  marketText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Hero Next Match Card
  heroCard: {
    marginBottom: 16,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  heroLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  heroOpponentTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
    marginBottom: 12,
  },
  heroMetaWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 16,
  },
  heroMetaItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  heroMetaText: {
    fontSize: 13,
    fontWeight: "500",
  },
  heroActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  heroActionBtn: {
    flex: 1,
    minWidth: 160,
  },

  // Season Metrics
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },

  // Two Column Layout
  columnsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 4,
  },
  columnLeft: {
    flex: 1,
    minWidth: 320,
  },
  columnRight: {
    flex: 1,
    minWidth: 320,
  },

  // Slim Enrollment Banner (Low Emphasis)
  enrollmentBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 12,
  },
  enrollmentTextCol: {
    flex: 1,
    minWidth: 260,
  },
  bannerTagRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  enrollmentHeadline: {
    fontSize: 13,
    fontWeight: "700",
  },
  enrollmentSub: {
    fontSize: 12,
  },

  // Recent Results List
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  resultMatchupCol: {
    flex: 1,
    minWidth: 180,
  },
  resultMatchupText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 2,
  },
  resultWinner: {
    fontWeight: "700",
  },
  resultVs: {
    fontWeight: "400",
  },
  resultLoser: {
    fontWeight: "600",
  },
  resultDivisionText: {
    fontSize: 11,
  },
  resultScoreCol: {
    alignItems: "flex-end",
    gap: 4,
  },
  resultScoreLine: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
  loadingFeed: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 13,
  },
});
