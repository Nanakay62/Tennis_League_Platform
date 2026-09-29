import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useCurrentUser, UserSession } from "../src/lib/auth";
import {
  getDivisionStandings,
  getDivisionRoster,
  getLatestScoresFeed,
  StandingRow,
  RosterPlayerResponse,
  LatestScoreFeedItem,
} from "../src/api/client";
import { useThemeColors } from "../src/theme/colors";
import { fonts } from "../src/theme/tokens";
import {
  AppShell,
  Card,
  MetricCard,
  ListRow,
  Button,
  Badge,
  StandingsTable,
  Avatar,
} from "../src/components";
import { MOCK_IMAGES } from "../src/constants/mockImages";


export default function HomeScreen() {
  const { colors, isDark } = useThemeColors();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const { data: user } = useCurrentUser();
  const [roster, setRoster] = useState<RosterPlayerResponse[]>([]);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [recentScores, setRecentScores] = useState<LatestScoreFeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      try {
        const [rosterRes, standingsData, scoresData] = await Promise.all([
          getDivisionRoster("div-comp-1"),
          getDivisionStandings("div-comp-1"),
          getLatestScoresFeed(),
        ]);

        setRoster(rosterRes.players || []);
        setStandings(standingsData || []);
        setRecentScores((scoresData || []).slice(0, 2));
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

  const opponentName = opponent ? opponent.display_name : "Lukas Schmidt";
  const userName = user?.displayName || "Player";
  const userAvatarUrl = user?.avatarUrl;

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
      {/* 1. Greeting Header */}
      <View style={styles.greetingSection}>
        <View style={styles.greetingCol}>
          <Text style={[styles.greetingHeadline, { color: colors.textPrimary }]}>
            Good evening, {userName.split(" ")[0]}
          </Text>
          <Text style={[styles.greetingSub, { color: colors.textSecondary }]}>
            Competitive 3.5 • Fall Season 2026
          </Text>
        </View>

        <View
          style={[
            styles.marketBadge,
            {
              backgroundColor: colors.surfaceMuted,
              borderColor: colors.borderSubtle,
            },
          ]}
        >
          <Feather
            name="map-pin"
            size={12}
            color={colors.textSecondary}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.marketText, { color: colors.textSecondary }]}>
            Frankfurt, Germany
          </Text>
          <Feather
            name="sun"
            size={12}
            color="#eab308"
            style={{ marginLeft: 8, marginRight: 4 }}
          />
          <Text style={[styles.marketText, { color: colors.textSecondary }]}>
            18°C
          </Text>
        </View>
      </View>

      {/* 2. Hero Card: Next Match (With Tennis Ball Image Backdrop and Fading White Gradient Overlay) */}
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        {/* Backdrop Layer: Tennis Ball on Clay Court with Fading White Overlay */}
        <View style={[styles.heroBackdrop, { pointerEvents: "none" }]}>
          <Image
            source={MOCK_IMAGES.heroTennisBall}
            style={[
              styles.heroBackdropImage,
              {
                left: isDesktop ? "32%" : "15%",
                width: isDesktop ? "68%" : "85%",
              },
            ]}
            resizeMode="cover"
          />

          {/* Fading White Horizontal Linear Gradient Overlay */}
          <LinearGradient
            colors={[
              colors.surface,                          // 100% solid white on the left for crisp text contrast
              colors.surface,                          // solid white spans player 1 and VS
              "rgba(255, 255, 255, 0.96)",             // subtle transition start
              "rgba(255, 255, 255, 0.65)",             // smooth blend
              "rgba(255, 255, 255, 0.15)",             // tennis ball shines through vibrant
              "rgba(255, 255, 255, 0.00)",             // transparent on the far right
            ]}
            locations={
              isDesktop
                ? [0, 0.44, 0.58, 0.72, 0.88, 1.0]
                : [0, 0.35, 0.52, 0.70, 0.88, 1.0]
            }
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </View>

        {/* Foreground Content */}
        <View style={[styles.heroDetailsCol, { maxWidth: isDesktop ? 620 : "100%" }]}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroBadgeRow}>
              <Feather
                name="calendar"
                size={14}
                color={colors.primary}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.heroNextMatchText, { color: colors.textPrimary }]}>
                Next Match
              </Text>
              <Badge label="Round 3" variant="neutral" size="sm" style={{ marginLeft: 8 }} />
            </View>
            <View style={[styles.heroLiveDot, { backgroundColor: colors.success }]} />
          </View>

          {/* Players Faceoff */}
          <View style={styles.playersFaceoff}>
            {/* Player 1 (User) */}
            <View style={styles.playerBlock}>
              <View style={styles.avatarWrapper}>
                <Avatar name={userName} avatarUrl={userAvatarUrl} size="lg" />
                <View style={styles.youBadge}>
                  <Text style={styles.youBadgeText}>YOU</Text>
                </View>
              </View>
              <Text
                style={[styles.heroPlayerName, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                {userName}
              </Text>
              <Text style={[styles.heroPlayerSub, { color: colors.textSecondary }]}>
                Competitive 3.5
              </Text>
            </View>

            {/* VS Marker */}
            <View style={styles.vsContainer}>
              <Text style={[styles.vsText, { color: colors.textMuted }]}>VS</Text>
            </View>

            {/* Player 2 (Opponent) */}
            <View style={styles.playerBlock}>
              <Avatar name={opponentName} size="lg" />
              <Text
                style={[styles.heroPlayerName, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                {opponentName}
              </Text>
              <Text style={[styles.heroPlayerSub, { color: colors.textSecondary }]}>
                Competitive 3.5
              </Text>
            </View>
          </View>

          {/* Match Metadata Row */}
          <View style={styles.heroMetaWrap}>
            <View style={styles.heroMetaItem}>
              <Feather
                name="clock"
                size={13}
                color={colors.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.heroMetaText, { color: colors.textSecondary }]}>
                Thu, Oct 8 • 18:00
              </Text>
            </View>
            <View style={styles.heroMetaItem}>
              <Feather
                name="map-pin"
                size={13}
                color={colors.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.heroMetaText, { color: colors.textSecondary }]}>
                TC Palmengarten
              </Text>
            </View>
            <View style={styles.heroMetaItem}>
              <Feather
                name="grid"
                size={13}
                color={colors.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.heroMetaText, { color: colors.textSecondary }]}>
                Clay Court 4
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View
            style={[
              styles.heroActionsRow,
              { flexDirection: isDesktop ? "row" : "column" },
            ]}
          >
            <Button
              variant="primary"
              size="md"
              href="/divisions/div-comp-1"
              icon="check-circle"
              style={isDesktop ? styles.heroActionBtnDesktop : styles.heroActionBtnMobile}
            >
              Confirm Match Details
            </Button>

            <Button
              variant="secondary"
              size="md"
              href="/scores/submit"
              icon="edit-3"
              style={isDesktop ? styles.heroActionBtnDesktop : styles.heroActionBtnMobile}
            >
              Report Score
            </Button>
          </View>
        </View>
      </View>

      {/* 3. Your Season Stat Metrics & Progress */}
      <Card style={styles.seasonCard}>
        <View style={styles.seasonHeaderRow}>
          <View style={styles.seasonTitleRow}>
            <Feather
              name="award"
              size={16}
              color={colors.primary}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.seasonTitle, { color: colors.textPrimary }]}>
              Your Season
            </Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <MetricCard label="Position" value={currentRank} />
          <MetricCard label="Record" value={currentRecord} />
          <MetricCard label="Games Won" value={currentPct} />
          <MetricCard label="Wins Needed" value={`${winsCount} / 5`} />
        </View>

        {/* Playoff Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTextRow}>
            <Feather
              name="check-circle"
              size={13}
              color={colors.primary}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.progressText, { color: colors.textSecondary }]}>
              {Math.max(5 - winsCount, 0)} matches until playoff eligibility
            </Text>
          </View>
          <View
            style={[
              styles.progressBarBg,
              { backgroundColor: colors.surfaceMuted },
            ]}
          >
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.min((winsCount / 5) * 100, 100)}%`,
                  backgroundColor: colors.primary,
                },
              ]}
            />
          </View>
        </View>
      </Card>

      {/* 4. Two Columns Layout: Left (Standings + Results) & Right (Quick Actions + Next Season) */}
      <View style={styles.columnsContainer}>
        {/* Left Column */}
        <View style={styles.columnLeft}>
          {/* Standings Preview */}
          <Card
            title="Standings"
            actionLink={{ label: "View All →", href: "/divisions/div-comp-1" }}
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

          {/* Recent League Results */}
          <Card
            title="Recent Results"
            actionLink={{ label: "View All →", href: "/scores" }}
            noPadding
            style={{ marginTop: 16 }}
          >
            {loading ? (
              <View style={styles.loadingFeed}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : recentScores.length > 0 ? (
              <View style={isDesktop ? styles.resultsGrid : styles.resultsStack}>
                {recentScores.map((match, idx) => {
                  const isLast = idx === recentScores.length - 1;

                  return (
                    <View
                      key={match.id || idx}
                      style={[
                        styles.resultCard,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.borderSubtle,
                        },
                      ]}
                    >
                      <View style={styles.resultHeader}>
                        <Badge label="CONFIRMED" variant="success" size="sm" />
                        <Text style={[styles.resultDate, { color: colors.textSecondary }]}>
                          Oct 4, 2026
                        </Text>
                      </View>

                      {/* Winner Row */}
                      <View style={styles.resultPlayerRow}>
                        <Avatar name={match.winner_name} size="xs" style={{ marginRight: 6 }} />
                        <Text
                          style={[styles.resultWinnerName, { color: colors.textPrimary }]}
                          numberOfLines={1}
                        >
                          {match.winner_name}
                        </Text>
                        <Text
                          style={[styles.resultScoreValue, { color: colors.textPrimary }]}
                        >
                          {match.score_line}
                        </Text>
                      </View>

                      {/* Loser Row */}
                      <View style={styles.resultPlayerRow}>
                        <Avatar name={match.loser_name} size="xs" style={{ marginRight: 6 }} />
                        <Text
                          style={[styles.resultLoserName, { color: colors.textSecondary }]}
                          numberOfLines={1}
                        >
                          {match.loser_name}
                        </Text>
                      </View>

                      {/* Division Meta */}
                      <Text style={[styles.resultMeta, { color: colors.textMuted }]}>
                        {match.division_name} • Clay Court
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.loadingFeed}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No recent scores recorded.
                </Text>
              </View>
            )}
          </Card>
        </View>

        {/* Right Column */}
        <View style={styles.columnRight}>
          {/* Quick Actions Card */}
          <Card title="Quick Actions" noPadding>
            <ListRow
              icon="edit-3"
              title="Report Match Score"
              subtitle="Confirm or submit your latest result"
              href="/scores/submit"
            />
            <ListRow
              icon="users"
              title="Find a Practice Partner"
              subtitle="Players near Frankfurt • 3.5"
              href="/partners"
            />
            <ListRow
              icon="map-pin"
              title="Browse Courts"
              subtitle="View courts, book and get directions"
              href="/courts"
            />

            {/* Shortcut Tiles Row */}
            <View
              style={[
                styles.shortcutRow,
                { borderTopColor: colors.borderSubtle, borderTopWidth: 1 },
              ]}
            >
              <Link href="/programs" asChild>
                <TouchableOpacity style={styles.shortcutBtn}>
                  <Feather name="calendar" size={18} color={colors.primary} />
                  <Text style={[styles.shortcutText, { color: colors.textSecondary }]}>
                    Programs
                  </Text>
                </TouchableOpacity>
              </Link>
              <Link href="/community/poty" asChild>
                <TouchableOpacity style={styles.shortcutBtn}>
                  <Feather name="users" size={18} color={colors.primary} />
                  <Text style={[styles.shortcutText, { color: colors.textSecondary }]}>
                    Community
                  </Text>
                </TouchableOpacity>
              </Link>
              <Link href="/account" asChild>
                <TouchableOpacity style={styles.shortcutBtn}>
                  <Feather name="grid" size={18} color={colors.primary} />
                  <Text style={[styles.shortcutText, { color: colors.textSecondary }]}>
                    More
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
          </Card>

          {/* Next Season Promo Card (With Mock Court Net Image) */}
          <View style={styles.promoCardContainer}>
            <View style={styles.promoImageWrapper}>
              <Image
                source={MOCK_IMAGES.seasonCourtNet}
                style={styles.promoBackgroundImage}
                resizeMode="cover"
              />
              <View style={styles.promoOverlay} />
            </View>

            <View style={styles.promoContent}>
              <Text style={styles.promoTag}>NEXT SEASON</Text>
              <Text style={styles.promoTitle}>Fall Season 2026</Text>
              <Text style={styles.promoSubtitle}>Open for enrollment</Text>

              <View style={styles.promoPillsRow}>
                <View style={styles.promoPill}>
                  <Text style={styles.promoPillText}>Competitive</Text>
                </View>
                <View style={styles.promoPill}>
                  <Text style={styles.promoPillText}>Skilled</Text>
                </View>
                <View style={styles.promoPill}>
                  <Text style={styles.promoPillText}>Advanced</Text>
                </View>
              </View>

              <View style={styles.promoBottomRow}>
                <Text style={styles.promoPrice}>€34.95</Text>
                <Button
                  variant="primary"
                  size="sm"
                  href="/join"
                  iconRight="arrow-right"
                  style={styles.promoJoinBtn}
                >
                  Join Now
                </Button>
              </View>
            </View>
          </View>
        </View>
      </View>
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
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  greetingSub: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: "500",
  },
  marketBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  marketText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Hero Next Match Card
  heroCard: {
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  heroBackdrop: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
  },
  heroBackdropImage: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    height: "100%",
  },
  heroDetailsCol: {
    position: "relative",
    zIndex: 2,
    padding: 20,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  heroBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  heroNextMatchText: {
    fontSize: 15,
    fontWeight: "700",
  },
  heroLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Players Faceoff
  playersFaceoff: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginBottom: 16,
    paddingVertical: 8,
  },
  playerBlock: {
    alignItems: "center",
    maxWidth: 140,
  },
  avatarWrapper: {
    position: "relative",
  },
  heroAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginBottom: 6,
  },
  youBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#15803d",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  youBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
  },
  heroPlayerName: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  heroPlayerSub: {
    fontSize: 12,
    marginTop: 1,
  },
  vsContainer: {
    paddingHorizontal: 8,
  },
  vsText: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1,
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
    gap: 10,
  },
  heroActionBtnDesktop: {
    flex: 1,
    minWidth: 160,
  },
  heroActionBtnMobile: {
    width: "100%",
  },

  // Season Card
  seasonCard: {
    marginBottom: 16,
    padding: 16,
  },
  seasonHeaderRow: {
    marginBottom: 12,
  },
  seasonTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  seasonTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  progressContainer: {
    marginTop: 4,
  },
  progressTextRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  progressText: {
    fontSize: 13,
    fontWeight: "500",
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },

  // Two Column Layout
  columnsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 16,
  },
  columnLeft: {
    flex: 1.2,
    minWidth: 320,
  },
  columnRight: {
    flex: 1,
    minWidth: 300,
    gap: 16,
  },

  // Results Grid & Cards
  resultsGrid: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  resultsStack: {
    gap: 12,
    padding: 12,
  },
  resultCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  resultDate: {
    fontSize: 11,
  },
  resultPlayerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
  },
  resultAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  resultWinnerName: {
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  resultLoserName: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  resultScoreValue: {
    fontSize: 13,
    fontWeight: "700",
  },
  resultMeta: {
    fontSize: 11,
    marginTop: 6,
  },

  // Quick Action Shortcuts
  shortcutRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
  },
  shortcutBtn: {
    alignItems: "center",
    paddingHorizontal: 12,
  },
  shortcutText: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: "600",
  },

  // Promo Card with Court Net Image
  promoCardContainer: {
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    minHeight: 200,
    justifyContent: "flex-end",
  },
  promoImageWrapper: {
    ...StyleSheet.absoluteFill,
  },
  promoBackgroundImage: {
    width: "100%",
    height: "100%",
  },
  promoOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(13, 43, 32, 0.78)",
  },
  promoContent: {
    padding: 20,
  },
  promoTag: {
    color: "#a7f3d0",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 4,
  },
  promoTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 2,
  },
  promoSubtitle: {
    color: "#e2e8f0",
    fontSize: 13,
    marginBottom: 12,
  },
  promoPillsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 16,
  },
  promoPill: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  promoPillText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600",
  },
  promoBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  promoPrice: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "800",
  },
  promoJoinBtn: {
    backgroundColor: "#34d399",
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
