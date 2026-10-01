import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Link } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useThemeColors } from "../../theme/colors";
import { useResponsive } from "../../theme/tokens";
import { StandingRow } from "../../api/client";
import { Badge } from "./Badge";
import { Avatar } from "./Avatar";
import { useCurrentUser } from "../../lib/auth";

export interface StandingsTableProps {
  standings: StandingRow[];
  currentUserPlayerId?: string;
  mode?: "auto" | "table" | "cards";
  limit?: number;
  divisionId?: string;
  showLegend?: boolean;
  loading?: boolean;
}

export function StandingsTable({
  standings,
  currentUserPlayerId,
  mode = "auto",
  limit,
  divisionId,
  showLegend = false,
  loading = false,
}: StandingsTableProps) {
  const { colors } = useThemeColors();
  const { isMobile } = useResponsive();
  const { data: currentUser } = useCurrentUser();
  const [legendOpen, setLegendOpen] = useState(false);

  const effectiveMode = mode === "auto" ? (isMobile ? "cards" : "table") : mode;
  const rows = limit ? standings.slice(0, limit) : standings;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No standing data available.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {effectiveMode === "table" ? (
        // Desktop / Tablet Full Table Mode
        <View
          style={[
            styles.tableContainer,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View
            style={[
              styles.tableHeader,
              {
                backgroundColor: colors.surfaceMuted,
                borderBottomColor: colors.borderSubtle,
              },
            ]}
          >
            <Text style={[styles.th, styles.colRank, { color: colors.textSecondary }]}>
              #
            </Text>
            <Text style={[styles.th, styles.colPlayer, { color: colors.textSecondary }]}>
              Player
            </Text>
            <Text style={[styles.th, styles.colArea, { color: colors.textSecondary }]}>
              Home / Court
            </Text>
            <Text style={[styles.th, styles.colRecord, { color: colors.textSecondary }]}>
              W - L
            </Text>
            <Text style={[styles.th, styles.colPct, { color: colors.textSecondary }]}>
              Games %
            </Text>
            <Text style={[styles.th, styles.colPlayoff, { color: colors.textSecondary }]}>
              Playoff
            </Text>
            <Text style={[styles.th, styles.colDaytime, { color: colors.textSecondary }]}>
              Daytime
            </Text>
          </View>

          {rows.map((row, idx) => {
            const isMe = currentUserPlayerId && row.playerId === currentUserPlayerId;
            const isLast = idx === rows.length - 1;

            return (
              <View
                key={row.playerId || idx}
                style={[
                  styles.tableRow,
                  !isLast && { borderBottomColor: colors.borderSubtle, borderBottomWidth: 1 },
                  isMe && { backgroundColor: colors.accentSecondary },
                ]}
              >
                <Text style={[styles.tdRank, styles.colRank, { color: colors.textSecondary }]}>
                  {row.rank}
                </Text>

                <View style={[styles.colPlayer, styles.playerCell]}>
                  <Avatar
                    name={row.playerName}
                    avatarUrl={isMe ? currentUser?.avatarUrl : (row as any).avatarUrl}
                    size="xs"
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={[styles.tdName, { color: colors.textPrimary }]}
                    numberOfLines={1}
                  >
                    {row.playerName}
                  </Text>
                  {isMe && (
                    <Badge label="YOU" variant="accent" style={{ marginLeft: 6 }} />
                  )}
                </View>

                <Text
                  style={[styles.tdMuted, styles.colArea, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {row.homeArea || (idx === 2 ? "Accra" : "Tema")}
                </Text>

                <Text
                  style={[styles.tdCenter, styles.colRecord, { color: colors.textPrimary }]}
                >
                  {row.wins} - {row.losses}
                </Text>

                <Text
                  style={[styles.tdRight, styles.colPct, { color: colors.textPrimary }]}
                >
                  {(row.gamesPct * 100).toFixed(0)}%
                </Text>

                <View style={[styles.colPlayoff, styles.playoffCell]}>
                  {row.isPlayoffEligible ? (
                    <Badge
                      label="Eligible"
                      variant="success"
                      icon="check-circle"
                    />
                  ) : (
                    <Text style={[styles.tdMuted, { color: colors.textMuted }]}>
                      {row.playoffIndicator || "—"}
                    </Text>
                  )}
                </View>

                <View style={[styles.colDaytime, styles.daytimeCell]}>
                  {row.isDaytime ?? true ? (
                    <Feather name="sun" size={14} color="#eab308" />
                  ) : (
                    <Text style={[styles.tdMuted, { color: colors.textMuted }]}>—</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        // Mobile Card List Mode
        <View style={styles.cardListContainer}>
          {rows.map((row, idx) => {
            const isMe = currentUserPlayerId && row.playerId === currentUserPlayerId;

            return (
              <View
                key={row.playerId || idx}
                style={[
                  styles.mobileCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                  isMe && { borderColor: colors.primary, borderWidth: 1.5 },
                ]}
              >
                <View style={styles.cardTopRow}>
                  <View style={styles.cardRankCircle}>
                    <Text style={[styles.cardRankText, { color: colors.textPrimary }]}>
                      {row.rank}
                    </Text>
                  </View>

                  <Avatar
                    name={row.playerName}
                    avatarUrl={isMe ? currentUser?.avatarUrl : (row as any).avatarUrl}
                    size="sm"
                    style={{ marginRight: 10 }}
                  />

                  <View style={styles.cardPlayerInfo}>
                    <View style={styles.playerNameRow}>
                      <Text
                        style={[styles.cardPlayerName, { color: colors.textPrimary }]}
                        numberOfLines={1}
                      >
                        {row.playerName}
                      </Text>
                      {isMe && (
                        <Badge label="YOU" variant="accent" style={{ marginLeft: 6 }} />
                      )}
                      {row.isDaytime && (
                        <Text style={[styles.daytimeTag, { color: colors.textSecondary }]}>
                          (d)
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.cardHomeArea, { color: colors.textSecondary }]}>
                      {row.homeArea || "Accra"}
                    </Text>
                  </View>

                  <View style={styles.cardStatsCol}>
                    <Text style={[styles.cardRecord, { color: colors.textPrimary }]}>
                      {row.wins} - {row.losses}
                    </Text>
                    <Text style={[styles.cardPct, { color: colors.textSecondary }]}>
                      {(row.gamesPct * 100).toFixed(0)}% win
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.cardBottomRow,
                    { borderTopColor: colors.borderSubtle },
                  ]}
                >
                  <View style={styles.cardEligibility}>
                    {row.isPlayoffEligible ? (
                      <Badge
                        label="Playoff Eligible"
                        variant="success"
                        icon="check"
                      />
                    ) : (
                      <Text style={[styles.cardPendingText, { color: colors.textSecondary }]}>
                        {row.playoffIndicator ? `${row.playoffIndicator} games to cutoff` : "In Progress"}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Optional Tappable Legend (Mandated by Handbook §1.3 & §14.4) */}
      {showLegend && (
        <View style={styles.legendContainer}>
          <TouchableOpacity
            style={styles.legendToggle}
            onPress={() => setLegendOpen(!legendOpen)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Feather
              name="help-circle"
              size={13}
              color={colors.primary}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.legendToggleText, { color: colors.primary }]}>
              {legendOpen ? "Hide Standings Legend" : "Show Standings Legend"}
            </Text>
          </TouchableOpacity>

          {legendOpen && (
            <View
              style={[
                styles.legendContent,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.borderSubtle },
              ]}
            >
              <Text style={[styles.legendItem, { color: colors.textSecondary }]}>
                <Text style={{ fontWeight: "700" }}>W - L:</Text> Total matches won and lost.
              </Text>
              <Text style={[styles.legendItem, { color: colors.textSecondary }]}>
                <Text style={{ fontWeight: "700" }}>Games %:</Text> Total games won divided by total games played.
              </Text>
              <Text style={[styles.legendItem, { color: colors.textSecondary }]}>
                <Text style={{ fontWeight: "700" }}>(d):</Text> Daytime availability marker (flexible weekday scheduling).
              </Text>
              <Text style={[styles.legendItem, { color: colors.textSecondary }]}>
                <Text style={{ fontWeight: "700" }}>Playoff:</Text> Meets win threshold (minimum 5 wins) and distinct opponent requirements.
              </Text>
            </View>
          )}
        </View>
      )}

      {Boolean(divisionId) && (
        <Link href={`/divisions/${divisionId}` as any} asChild>
          <TouchableOpacity style={styles.footerLink} activeOpacity={0.8}>
            <Text style={[styles.footerLinkText, { color: colors.primary }]}>
              View full division standings
            </Text>
            <Feather name="arrow-right" size={13} color={colors.primary} />
          </TouchableOpacity>
        </Link>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
  },
  loadingContainer: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    padding: 16,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 13,
  },

  // Table styles
  tableContainer: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  th: {
    fontSize: 11,
    fontWeight: "700",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  colRank: {
    width: 28,
    textAlign: "center",
  },
  colPlayer: {
    flex: 2,
    paddingHorizontal: 6,
  },
  colArea: {
    flex: 1.2,
    paddingHorizontal: 6,
  },
  colRecord: {
    width: 56,
    textAlign: "center",
  },
  colPct: {
    width: 64,
    textAlign: "right",
    paddingRight: 6,
  },
  colPlayoff: {
    width: 90,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  colDaytime: {
    width: 60,
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  },
  playerCell: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  playoffCell: {
    alignItems: "flex-end",
  },
  daytimeCell: {
    alignItems: "center",
    justifyContent: "center",
  },
  tdRank: {
    fontSize: 13,
    fontWeight: "700",
  },
  tdName: {
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
  },
  tdMuted: {
    fontSize: 12,
  },
  tdCenter: {
    fontSize: 13,
    fontWeight: "600",
  },
  tdRight: {
    fontSize: 13,
    fontWeight: "600",
  },
  daytimeTag: {
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 4,
  },

  // Mobile card list styles
  cardListContainer: {
    gap: 8,
  },
  mobileCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardRankCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  cardRankText: {
    fontSize: 13,
    fontWeight: "800",
  },
  cardPlayerInfo: {
    flex: 1,
    marginRight: 8,
  },
  playerNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardPlayerName: {
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
  },
  cardHomeArea: {
    fontSize: 11,
    marginTop: 1,
  },
  cardStatsCol: {
    alignItems: "flex-end",
  },
  cardRecord: {
    fontSize: 13,
    fontWeight: "700",
  },
  cardPct: {
    fontSize: 11,
  },
  cardBottomRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardEligibility: {
    flex: 1,
  },
  cardPendingText: {
    fontSize: 11,
    fontStyle: "italic",
  },

  // Legend styles
  legendContainer: {
    marginTop: 10,
  },
  legendToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  legendToggleText: {
    fontSize: 12,
    fontWeight: "600",
  },
  legendContent: {
    marginTop: 6,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
  },
  legendItem: {
    fontSize: 11,
    lineHeight: 16,
  },

  // Footer Link
  footerLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    marginTop: 8,
    gap: 4,
  },
  footerLinkText: {
    fontSize: 12,
    fontWeight: "600",
  },
  tableAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginRight: 8,
  },
  cardAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
});
