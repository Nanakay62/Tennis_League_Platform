import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Linking,
} from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { colors } from "../../src/theme/colors";
import { getCompatiblePartners, PartnerMatch } from "../../src/api/client";

export default function PartnerProgramScreen() {
  const {
    data: partners,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["partners"],
    queryFn: getCompatiblePartners,
  });

  const handleCall = (phone: string | null) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const handleEmail = (email: string | null) => {
    if (email) Linking.openURL(`mailto:${email}`);
  };

  const renderItem = ({ item }: { item: PartnerMatch }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.partnerName}>{item.display_name}</Text>
            {item.is_daytime && <Text style={styles.daytimeFlag}>☀️ Daytime</Text>}
          </View>
          <Text style={styles.partnerMeta}>
            📍 {item.home_area || "Frankfurt"} • Rating: {item.rating || "3.5"}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.challengeBtn}
          onPress={() => router.push(`/scores/submit?opponentId=${item.player_id}`)}
        >
          <Text style={styles.challengeBtnText}>Report Score</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.contactRow}>
        {item.phone ? (
          <TouchableOpacity
            style={styles.contactBtn}
            onPress={() => handleCall(item.phone)}
            accessible={true}
            accessibilityRole="link"
            accessibilityLabel={`Call partner ${item.display_name} at ${item.phone}`}
          >
            <Text style={styles.contactBtnText}>📞 {item.phone}</Text>
          </TouchableOpacity>
        ) : null}

        {item.email ? (
          <TouchableOpacity
            style={styles.contactBtn}
            onPress={() => handleEmail(item.email)}
            accessible={true}
            accessibilityRole="link"
            accessibilityLabel={`Email partner ${item.display_name} at ${item.email}`}
          >
            <Text style={styles.contactBtnText}>✉️ {item.email}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Reward Promo Banner */}
      <View style={styles.promoBanner}>
        <Text style={styles.promoIcon}>🎁</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.promoTitle}>Monthly Partner Reward (€5.00 Credit)</Text>
          <Text style={styles.promoDesc}>
            Play matches with at least 3 distinct partners in a calendar month to receive a €5.00 discount voucher towards your next season!
          </Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Compatible Hitting Partners</Text>
        <Text style={styles.sectionSubtitle}>
          Matched within ±0.5 NTRP in your Frankfurt area.
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Finding hitting partners...</Text>
        </View>
      ) : isError ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Unable to load partner suggestions.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={partners || []}
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
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🎾</Text>
              <Text style={styles.emptyTitle}>No partners found in this band</Text>
              <Text style={styles.emptySubtitle}>
                More players in Frankfurt are joining weekly!
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
  promoBanner: {
    backgroundColor: "#e8f5e9",
    borderBottomWidth: 1,
    borderBottomColor: "#c8e6c9",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  promoIcon: {
    fontSize: 28,
  },
  promoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  promoDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  partnerName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  daytimeFlag: {
    fontSize: 11,
    fontWeight: "600",
    color: "#e65100",
    backgroundColor: "#fff3e0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  partnerMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 3,
  },
  challengeBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  challengeBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
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
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
    minWidth: 44,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  contactBtnText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: "500",
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
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
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
