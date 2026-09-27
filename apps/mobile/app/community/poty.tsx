import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { colors } from "../../src/theme/colors";
import {
  getPOTYLeaderboard,
  getReferralInfo,
  POTYItem,
} from "../../src/api/client";

export default function POTYLeaderboardScreen() {
  const {
    data: leaderboard,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["poty"],
    queryFn: getPOTYLeaderboard,
  });

  const { data: referral } = useQuery({
    queryKey: ["referral-info"],
    queryFn: getReferralInfo,
  });

  const copyReferral = () => {
    if (referral?.referral_link) {
      if (Platform.OS === "web") {
        navigator.clipboard?.writeText(referral.referral_link);
        alert("Referral link copied to clipboard!");
      } else {
        alert(`Your referral code is: ${referral.referral_code}`);
      }
    }
  };

  const top3 = leaderboard?.slice(0, 3) || [];
  const rest = leaderboard?.slice(3) || [];

  const renderItem = ({ item }: { item: POTYItem }) => (
    <View style={styles.rowCard}>
      <Text style={styles.rankNum}>#{item.rank}</Text>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.playerName}>{item.display_name}</Text>
        <Text style={styles.playerMeta}>
          📍 {item.home_area || "Frankfurt"} • {item.matches_played} matches ({item.matches_won}W)
        </Text>
      </View>
      <View style={styles.pointsBadge}>
        <Text style={styles.pointsText}>{item.total_points}</Text>
        <Text style={styles.pointsLabel}>pts</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Referral Share Card */}
      {referral && (
        <View style={styles.referralCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.refTitle}>Invite Friends & Earn €5.00</Text>
            <Text style={styles.refSub}>
              Share code <Text style={styles.refCode}>{referral.referral_code}</Text> — you both get €5 off!
            </Text>
          </View>
          <TouchableOpacity style={styles.copyBtn} onPress={copyReferral}>
            <Text style={styles.copyBtnText}>Copy Link</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Header Info */}
      <View style={styles.header}>
        <Text style={styles.title}>Player of the Year (POTY)</Text>
        <Text style={styles.subtitle}>
          Points: 10 per match played • 5 per win • 5 per unique opponent
        </Text>
      </View>

      {/* Podium for Top 3 */}
      {top3.length > 0 && (
        <View style={styles.podiumContainer}>
          {/* 2nd Place */}
          {top3[1] && (
            <View style={[styles.podiumCol, { marginTop: 24 }]}>
              <Text style={styles.podiumMedal}>🥈</Text>
              <Text style={styles.podiumName} numberOfLines={1}>
                {top3[1].display_name}
              </Text>
              <Text style={styles.podiumPts}>{top3[1].total_points} pts</Text>
              <View style={[styles.podiumBar, { height: 60, backgroundColor: "#cfd8dc" }]} />
            </View>
          )}

          {/* 1st Place */}
          {top3[0] && (
            <View style={styles.podiumCol}>
              <Text style={styles.podiumMedal}>👑</Text>
              <Text style={[styles.podiumName, { fontWeight: "800" }]} numberOfLines={1}>
                {top3[0].display_name}
              </Text>
              <Text style={[styles.podiumPts, { color: colors.primary }]}>
                {top3[0].total_points} pts
              </Text>
              <View style={[styles.podiumBar, { height: 90, backgroundColor: colors.primary }]} />
            </View>
          )}

          {/* 3rd Place */}
          {top3[2] && (
            <View style={[styles.podiumCol, { marginTop: 36 }]}>
              <Text style={styles.podiumMedal}>🥉</Text>
              <Text style={styles.podiumName} numberOfLines={1}>
                {top3[2].display_name}
              </Text>
              <Text style={styles.podiumPts}>{top3[2].total_points} pts</Text>
              <View style={[styles.podiumBar, { height: 45, backgroundColor: "#d7ccc8" }]} />
            </View>
          )}
        </View>
      )}

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading POTY standings...</Text>
        </View>
      ) : isError ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Unable to load POTY leaderboard.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={rest}
          keyExtractor={(item) => item.player_id}
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
            top3.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🏆</Text>
                <Text style={styles.emptyTitle}>Season leaderboard opening</Text>
                <Text style={styles.emptySubtitle}>Play verified matches to earn points!</Text>
              </View>
            ) : null
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
  referralCard: {
    backgroundColor: "#fffde7",
    borderBottomWidth: 1,
    borderBottomColor: "#fff59d",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  refTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#f57f17",
  },
  refSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  refCode: {
    fontWeight: "700",
    color: colors.text,
  },
  copyBtn: {
    backgroundColor: "#fbc02d",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#212121",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  podiumContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  podiumCol: {
    flex: 1,
    alignItems: "center",
  },
  podiumMedal: {
    fontSize: 26,
    marginBottom: 4,
  },
  podiumName: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
  },
  podiumPts: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
    marginBottom: 8,
  },
  podiumBar: {
    width: "80%",
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
  },
  rankNum: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.textSecondary,
    width: 32,
  },
  playerName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  playerMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  pointsBadge: {
    alignItems: "flex-end",
  },
  pointsText: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.primary,
  },
  pointsLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: "600",
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: 14,
    color: colors.danger,
    marginBottom: 10,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryBtnText: {
    color: "#fff",
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 50,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
