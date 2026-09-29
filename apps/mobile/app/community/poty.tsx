import React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Image,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useThemeColors } from "../../src/theme/colors";
import {
  getPOTYLeaderboard,
  getReferralInfo,
  POTYItem,
} from "../../src/api/client";
import { AppShell, Card, Badge, Button, EmptyState, Avatar } from "../../src/components";

export default function POTYLeaderboardScreen() {
  const { colors, isDark } = useThemeColors();

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
    <Card style={styles.rowCard}>
      <View style={styles.rankBadge}>
        <Text style={[styles.rankNum, { color: colors.textSecondary }]}>
          #{item.rank}
        </Text>
      </View>

      <Avatar name={item.display_name} size="sm" style={{ marginRight: 10 }} />

      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={[styles.playerName, { color: colors.textPrimary }]}>
          {item.display_name}
        </Text>
        <View style={styles.metaRow}>
          <Feather
            name="map-pin"
            size={11}
            color={colors.textSecondary}
            style={{ marginRight: 3 }}
          />
          <Text style={[styles.playerMeta, { color: colors.textSecondary }]}>
            {item.home_area || "Frankfurt"} • {item.matches_played} matches ({item.matches_won}W)
          </Text>
        </View>
      </View>

      <Badge
        variant="accent"
        label={`${item.total_points} pts`}
      />
    </Card>
  );

  return (
    <AppShell title="COMMUNITY">
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Player of the Year (POTY)
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Points: 10 per match played • 5 per win • 5 per unique opponent
        </Text>
      </View>

      {/* Referral Share Card */}
      {referral && (
        <Card
          style={[
            styles.referralCard,
            { backgroundColor: isDark ? colors.surfaceSecondary : "#fdfbf7" },
          ]}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <View style={styles.referralHeader}>
              <Feather name="gift" size={16} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.refTitle, { color: colors.textPrimary }]}>
                Invite Friends & Earn €5.00
              </Text>
            </View>
            <Text style={[styles.refSub, { color: colors.textSecondary }]}>
              Share code <Text style={[styles.refCode, { color: colors.primary }]}>{referral.referral_code}</Text> — you both get €5 off!
            </Text>
          </View>

          <Button
            size="sm"
            variant="secondary"
            icon="copy"
            onPress={copyReferral}
            accessibilityLabel="Copy Referral Link"
          >
            Copy Link
          </Button>
        </Card>
      )}

      {/* Podium for Top 3 */}
      {top3.length > 0 && (
        <View style={styles.podiumContainer}>
          {/* 2nd Place */}
          {top3[1] && (
            <View style={[styles.podiumCol, { marginTop: 24 }]}>
              <Badge variant="neutral" icon="award" label="2nd" size="sm" />
              <Avatar
                name={top3[1].display_name}
                size={48}
                style={{ marginVertical: 8 }}
              />
              <Text
                style={[styles.podiumName, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                {top3[1].display_name}
              </Text>
              <Text style={[styles.podiumPts, { color: colors.textSecondary }]}>
                {top3[1].total_points} pts
              </Text>
              <View
                style={[
                  styles.podiumBar,
                  {
                    height: 60,
                    backgroundColor: colors.surfaceMuted,
                    borderColor: colors.borderSubtle,
                  },
                ]}
              />
            </View>
          )}

          {/* 1st Place */}
          {top3[0] && (
            <View style={styles.podiumCol}>
              <Badge variant="warning" icon="award" label="Champion" size="sm" />
              <Avatar
                name={top3[0].display_name}
                size={56}
                style={{ marginVertical: 8 }}
              />
              <Text
                style={[styles.podiumName, { color: colors.textPrimary, fontWeight: "800" }]}
                numberOfLines={1}
              >
                {top3[0].display_name}
              </Text>
              <Text style={[styles.podiumPts, { color: colors.primary, fontWeight: "700" }]}>
                {top3[0].total_points} pts
              </Text>
              <View
                style={[
                  styles.podiumBar,
                  {
                    height: 90,
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  },
                ]}
              />
            </View>
          )}

          {/* 3rd Place */}
          {top3[2] && (
            <View style={[styles.podiumCol, { marginTop: 36 }]}>
              <Badge variant="neutral" icon="award" label="3rd" size="sm" />
              <Avatar
                name={top3[2].display_name}
                size={48}
                style={{ marginVertical: 8 }}
              />
              <Text
                style={[styles.podiumName, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                {top3[2].display_name}
              </Text>
              <Text style={[styles.podiumPts, { color: colors.textSecondary }]}>
                {top3[2].total_points} pts
              </Text>
              <View
                style={[
                  styles.podiumBar,
                  {
                    height: 45,
                    backgroundColor: colors.surfaceMuted,
                    borderColor: colors.borderSubtle,
                  },
                ]}
              />
            </View>
          )}
        </View>
      )}

      {/* Full Leaderboard List */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading POTY standings...
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
            Unable to load POTY leaderboard.
          </Text>
          <Button variant="secondary" size="sm" onPress={() => refetch()}>
            Retry
          </Button>
        </View>
      ) : (
        <FlatList
          data={rest}
          keyExtractor={(item) => item.player_id}
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
            top3.length === 0 ? (
              <EmptyState
                icon="award"
                title="No POTY rankings yet"
                message="Play matches this season to earn points and climb the leaderboard."
              />
            ) : null
          }
        />
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  header: {
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
  referralCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    marginBottom: 16,
  },
  referralHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  refTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  refSub: {
    fontSize: 13,
  },
  refCode: {
    fontWeight: "800",
  },
  podiumContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingVertical: 16,
    marginBottom: 20,
    gap: 12,
  },
  podiumCol: {
    flex: 1,
    maxWidth: 130,
    alignItems: "center",
  },
  podiumAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginVertical: 8,
  },
  championAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
  },
  podiumName: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 2,
  },
  podiumPts: {
    fontSize: 12,
    marginBottom: 8,
  },
  podiumBar: {
    width: "100%",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1,
  },
  listContent: {
    paddingBottom: 32,
    gap: 8,
  },
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  rankBadge: {
    width: 32,
    alignItems: "center",
  },
  rankNum: {
    fontSize: 14,
    fontWeight: "700",
  },
  playerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  playerName: {
    fontSize: 15,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  playerMeta: {
    fontSize: 12,
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
