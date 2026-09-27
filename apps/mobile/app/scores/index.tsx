import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { colors } from "../../src/theme/colors";
import { getLatestScoresFeed, LatestScoreFeedItem } from "../../src/api/client";

export default function LatestScoresScreen() {
  const {
    data: scores,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["latest-scores"],
    queryFn: getLatestScoresFeed,
  });

  const renderItem = ({ item }: { item: LatestScoreFeedItem }) => {
    const formattedDate = new Date(item.played_at).toLocaleDateString("de-DE", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const isRetirement = item.outcome_type === "retired";
    const isWalkover = item.outcome_type === "walkover" || item.outcome_type === "no_show";

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.divisionTag}>{item.division_name}</Text>
          <Text style={styles.dateText}>{formattedDate}</Text>
        </View>

        <View style={styles.matchBody}>
          <View style={styles.playersColumn}>
            <View style={styles.playerRow}>
              <Text style={styles.trophy}>🏆</Text>
              <Text style={styles.winnerName} numberOfLines={1}>
                {item.winner_name}
              </Text>
            </View>
            <View style={styles.playerRow}>
              <Text style={styles.loserBullet}>•</Text>
              <Text style={styles.loserName} numberOfLines={1}>
                {item.loser_name}
              </Text>
            </View>
          </View>

          <View style={styles.scoreColumn}>
            <Text style={styles.scoreText}>{item.score_line}</Text>
            {isRetirement && <Text style={styles.statusBadgeDanger}>Retired</Text>}
            {isWalkover && <Text style={styles.statusBadgeWarning}>Walkover / No-Show</Text>}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Banner & Action */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>Latest Results</Text>
          <Text style={styles.subtitle}>Verified scores across Frankfurt flex divisions</Text>
        </View>
        <TouchableOpacity
          style={styles.reportBtn}
          onPress={() => router.push("/scores/submit")}
          activeOpacity={0.8}
        >
          <Text style={styles.reportBtnText}>+ Report Score</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading verified scores...</Text>
        </View>
      ) : isError ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Unable to load scores feed.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={scores || []}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🎾</Text>
              <Text style={styles.emptyTitle}>No matches recorded yet</Text>
              <Text style={styles.emptySubtitle}>
                Be the first to play and report your score!
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  reportBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  reportBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSecondary,
    paddingBottom: 6,
  },
  divisionTag: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dateText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  matchBody: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  playersColumn: {
    flex: 1,
    marginRight: 16,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 3,
  },
  trophy: {
    fontSize: 14,
    marginRight: 6,
  },
  winnerName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  loserBullet: {
    fontSize: 16,
    color: colors.textMuted,
    marginRight: 8,
    marginLeft: 3,
  },
  loserName: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  scoreColumn: {
    alignItems: "flex-end",
  },
  scoreText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary,
  },
  statusBadgeDanger: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.danger,
    backgroundColor: "#ffebee",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  statusBadgeWarning: {
    fontSize: 11,
    fontWeight: "600",
    color: "#e65100",
    backgroundColor: "#fff3e0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: 15,
    color: colors.danger,
    marginBottom: 12,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryBtnText: {
    color: "#fff",
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
