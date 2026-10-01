import React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Image,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useThemeColors } from "../../src/theme/colors";
import { getLatestScoresFeed, LatestScoreFeedItem } from "../../src/api/client";
import { formatScoreForScreenReader } from "../../src/lib/accessibility";
import { AppShell, Card, Badge, Button, EmptyState, Avatar } from "../../src/components";

export default function LatestScoresScreen() {
  const { colors } = useThemeColors();

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
    const formattedDate = new Date(item.played_at).toLocaleDateString("en-GB", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const isRetirement = item.outcome_type === "retired";
    const isWalkover = item.outcome_type === "walkover" || item.outcome_type === "no_show";
    const spokenScore = formatScoreForScreenReader(item.score_line);
    const cardAccessibilityLabel = `${item.winner_name} defeated ${item.loser_name}, score ${spokenScore}, in division ${item.division_name}, played on ${formattedDate}`;

    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Badge variant="neutral" size="sm" label={item.division_name} />
          <Text style={[styles.dateText, { color: colors.textSecondary }]}>
            {formattedDate}
          </Text>
        </View>

        <View style={styles.matchBody}>
          <View style={styles.playersColumn}>
            {/* Winner */}
            <View style={styles.playerRow}>
              <Avatar name={item.winner_name} size="xs" style={{ marginRight: 8 }} />
              <Text
                style={[styles.winnerName, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                {item.winner_name}
              </Text>
              <Feather
                name="check"
                size={14}
                color={colors.primary}
                style={{ marginLeft: 6 }}
              />
            </View>

            {/* Loser */}
            <View style={styles.playerRow}>
              <Avatar name={item.loser_name} size="xs" style={{ marginRight: 8 }} />
              <Text
                style={[styles.loserName, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {item.loser_name}
              </Text>
            </View>
          </View>

          <View style={styles.scoreColumn}>
            <Text style={[styles.scoreText, { color: colors.textPrimary }]}>
              {item.score_line}
            </Text>
            {isRetirement ? (
              <Badge variant="danger" size="sm" label="Retired" />
            ) : isWalkover ? (
              <Badge variant="warning" size="sm" label="Walkover" />
            ) : (
              <Badge variant="success" size="sm" label="CONFIRMED" />
            )}
          </View>
        </View>
      </Card>
    );
  };

  return (
    <AppShell title="LATEST SCORES">
      {/* Header & Primary Action */}
      <View style={styles.topBar}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Latest Results
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Verified scores across Accra flex divisions
          </Text>
        </View>

        <Button
          variant="primary"
          size="sm"
          href="/scores/submit"
          icon="plus"
          accessibilityLabel="Report match score"
        >
          Report Score
        </Button>
      </View>

      {/* Scores Feed */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading verified scores...
          </Text>
        </View>
      ) : isError ? (
        <View style={styles.centerContainer}>
          <Feather
            name="alert-circle"
            size={36}
            color={colors.danger}
            style={{ marginBottom: 12 }}
          />
          <Text style={[styles.errorText, { color: colors.danger }]}>
            Unable to load scores feed.
          </Text>
          <Button variant="secondary" size="sm" onPress={() => refetch()}>
            Retry
          </Button>
        </View>
      ) : (
        <FlatList
          data={scores || []}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          scrollEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="clipboard"
              title="No matches recorded yet"
              message="Be the first to play and report your score!"
              action={{
                label: "Report Score",
                href: "/scores/submit",
              }}
            />
          }
        />
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  listContent: {
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  dateText: {
    fontSize: 12,
  },
  matchBody: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  playersColumn: {
    flex: 1,
    gap: 8,
    marginRight: 16,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  playerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  winnerName: {
    fontSize: 15,
    fontWeight: "700",
  },
  loserName: {
    fontSize: 14,
    fontWeight: "500",
  },
  scoreColumn: {
    alignItems: "flex-end",
    gap: 6,
  },
  scoreText: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  centerContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },
});
