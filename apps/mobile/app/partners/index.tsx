import React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Image,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useThemeColors } from "../../src/theme/colors";
import { getCompatiblePartners, PartnerMatch } from "../../src/api/client";
import { AppShell, Card, Badge, Button, EmptyState, Avatar } from "../../src/components";

export default function PartnerProgramScreen() {
  const { colors, isDark } = useThemeColors();

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
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <Avatar name={item.display_name} size="md" style={{ marginRight: 12 }} />

        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={[styles.partnerName, { color: colors.textPrimary }]}>
              {item.display_name}
            </Text>
            {item.is_daytime && (
              <Badge variant="neutral" icon="sun" size="sm" label="Daytime" />
            )}
          </View>

          <View style={styles.metaRow}>
            <Feather
              name="map-pin"
              size={12}
              color={colors.textSecondary}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.partnerMeta, { color: colors.textSecondary }]}>
              {item.home_area || "Accra"}
            </Text>
            <Badge
              variant="accent"
              size="sm"
              label={`NTRP ${item.rating || "3.5"}`}
              style={{ marginLeft: 8 }}
            />
          </View>
        </View>

        <Button
          size="sm"
          variant="primary"
          href={`/scores/submit?opponentId=${item.player_id}`}
        >
          Report Score
        </Button>
      </View>

      {/* Contact Options */}
      <View style={[styles.contactRow, { borderTopColor: colors.borderSubtle }]}>
        {item.phone ? (
          <Button
            size="sm"
            variant="secondary"
            icon="phone"
            onPress={() => handleCall(item.phone)}
            accessibilityLabel={`Call partner ${item.display_name} at ${item.phone}`}
          >
            {item.phone}
          </Button>
        ) : null}

        {item.email ? (
          <Button
            size="sm"
            variant="secondary"
            icon="mail"
            onPress={() => handleEmail(item.email)}
            accessibilityLabel={`Email partner ${item.display_name} at ${item.email}`}
          >
            {item.email}
          </Button>
        ) : null}
      </View>
    </Card>
  );

  return (
    <AppShell title="COMMUNITY">
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Practice Partners
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Matched within ±0.5 NTRP in your Accra/Tema area.
        </Text>
      </View>

      {/* Reward Promo Banner */}
      <Card
        style={[
          styles.promoBanner,
          { backgroundColor: isDark ? colors.surfaceSecondary : "#fdfbf7" },
        ]}
      >
        <Feather
          name="gift"
          size={20}
          color={colors.primary}
          style={{ marginRight: 12, marginTop: 2 }}
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.promoTitle, { color: colors.textPrimary }]}>
            Monthly Partner Reward (GH₵ 50.00 Credit)
          </Text>
          <Text style={[styles.promoDesc, { color: colors.textSecondary }]}>
            Play matches with at least 3 distinct partners in a calendar month to receive a GH₵ 50.00 discount voucher towards your next season!
          </Text>
        </View>
      </Card>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Finding hitting partners...
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
            Unable to load partner suggestions.
          </Text>
          <Button variant="secondary" size="sm" onPress={() => refetch()}>
            Retry
          </Button>
        </View>
      ) : (
        <FlatList
          data={partners || []}
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
            <EmptyState
              icon="users"
              title="No partners found in this band"
              message="More players in Accra & Tema are joining weekly!"
            />
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
  promoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    marginBottom: 20,
  },
  promoTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  promoDesc: {
    fontSize: 13,
    lineHeight: 18,
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
    alignItems: "center",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  partnerName: {
    fontSize: 16,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  partnerMeta: {
    fontSize: 13,
  },
  contactRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
    borderTopWidth: 1,
    paddingTop: 12,
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
