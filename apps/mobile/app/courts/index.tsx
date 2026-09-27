import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Linking,
  ScrollView,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { colors } from "../../src/theme/colors";
import { getCourts, Court } from "../../src/api/client";

export default function CourtsDirectoryScreen() {
  const [selectedSurface, setSelectedSurface] = useState<string | null>(null);
  const [filterIndoor, setFilterIndoor] = useState<boolean | null>(null);
  const [filterLights, setFilterLights] = useState<boolean | null>(null);
  const [filterWall, setFilterWall] = useState<boolean | null>(null);

  const {
    data: courts,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["courts", selectedSurface, filterIndoor, filterLights, filterWall],
    queryFn: () =>
      getCourts({
        surface: selectedSurface || undefined,
        is_indoor: filterIndoor !== null ? filterIndoor : undefined,
        has_lights: filterLights !== null ? filterLights : undefined,
        has_hitting_wall: filterWall !== null ? filterWall : undefined,
      }),
  });

  const openBooking = (url: string | null) => {
    if (url) Linking.openURL(url);
  };

  const openMap = (court: Court) => {
    const query = encodeURIComponent(`${court.name}, ${court.address}, ${court.city}`);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
  };

  const renderItem = ({ item }: { item: Court }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.courtName}>{item.name}</Text>
          <Text style={styles.courtAddress}>
            📍 {item.address}, {item.postal_code} {item.city}
          </Text>
        </View>
        <View style={styles.ratingBadge}>
          <Text style={styles.ratingStar}>★</Text>
          <Text style={styles.ratingText}>
            {item.average_rating > 0 ? item.average_rating.toFixed(1) : "New"}
          </Text>
          {item.review_count > 0 && (
            <Text style={styles.reviewCount}>({item.review_count})</Text>
          )}
        </View>
      </View>

      {/* Surface & Amenities Badges */}
      <View style={styles.amenitiesRow}>
        <View style={styles.surfaceBadge}>
          <Text style={styles.surfaceText}>{item.surface.toUpperCase()}</Text>
        </View>
        <Text style={styles.courtsCountBadge}>{item.num_courts} Courts</Text>
        {item.is_indoor && <Text style={styles.amenityBadge}>Indoor</Text>}
        {item.has_lights && <Text style={styles.amenityBadge}>Floodlights</Text>}
        {item.has_hitting_wall && <Text style={styles.amenityBadge}>Hitting Wall</Text>}
      </View>

      {/* Actions */}
      <View style={styles.actionsRow}>
        {item.booking_url ? (
          <TouchableOpacity
            style={styles.bookButton}
            onPress={() => openBooking(item.booking_url)}
          >
            <Text style={styles.bookButtonText}>Book Court ↗</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={styles.mapButton} onPress={() => openMap(item)}>
          <Text style={styles.mapButtonText}>Directions 📍</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Filter Chips Bar */}
      <View style={styles.filtersWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
          <TouchableOpacity
            style={[styles.filterChip, selectedSurface === null && !filterIndoor && !filterLights && styles.filterChipActive]}
            onPress={() => {
              setSelectedSurface(null);
              setFilterIndoor(null);
              setFilterLights(null);
              setFilterWall(null);
            }}
          >
            <Text style={[styles.filterChipText, selectedSurface === null && !filterIndoor && !filterLights && styles.filterChipTextActive]}>
              All Courts
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, selectedSurface === "clay" && styles.filterChipActive]}
            onPress={() => setSelectedSurface(selectedSurface === "clay" ? null : "clay")}
          >
            <Text style={[styles.filterChipText, selectedSurface === "clay" && styles.filterChipTextActive]}>
              Clay (Sand)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, selectedSurface === "hard" && styles.filterChipActive]}
            onPress={() => setSelectedSurface(selectedSurface === "hard" ? null : "hard")}
          >
            <Text style={[styles.filterChipText, selectedSurface === "hard" && styles.filterChipTextActive]}>
              Hard Court
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, selectedSurface === "carpet" && styles.filterChipActive]}
            onPress={() => setSelectedSurface(selectedSurface === "carpet" ? null : "carpet")}
          >
            <Text style={[styles.filterChipText, selectedSurface === "carpet" && styles.filterChipTextActive]}>
              Carpet / Teppich
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterIndoor === true && styles.filterChipActive]}
            onPress={() => setFilterIndoor(filterIndoor === true ? null : true)}
          >
            <Text style={[styles.filterChipText, filterIndoor === true && styles.filterChipTextActive]}>
              Halle / Indoor
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterLights === true && styles.filterChipActive]}
            onPress={() => setFilterLights(filterLights === true ? null : true)}
          >
            <Text style={[styles.filterChipText, filterLights === true && styles.filterChipTextActive]}>
              Flutlicht
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterWall === true && styles.filterChipActive]}
            onPress={() => setFilterWall(filterWall === true ? null : true)}
          >
            <Text style={[styles.filterChipText, filterWall === true && styles.filterChipTextActive]}>
              Ballwand
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Courts List */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Finding Frankfurt courts...</Text>
        </View>
      ) : isError ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Unable to load courts directory.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={courts || []}
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
              <Text style={styles.emptyTitle}>No courts match these filters</Text>
              <Text style={styles.emptySubtitle}>Try clearing some filter tags.</Text>
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
  filtersWrapper: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10,
  },
  filtersScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: "#fff",
    fontWeight: "700",
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
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  courtName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  courtAddress: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 3,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff8e1",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginLeft: 8,
  },
  ratingStar: {
    color: "#fbc02d",
    fontSize: 14,
    marginRight: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#f57f17",
  },
  reviewCount: {
    fontSize: 11,
    color: colors.textMuted,
    marginLeft: 3,
  },
  amenitiesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginVertical: 8,
  },
  surfaceBadge: {
    backgroundColor: "#efebe9",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  surfaceText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#5d4037",
  },
  courtsCountBadge: {
    backgroundColor: colors.surfaceSecondary,
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  amenityBadge: {
    backgroundColor: "#e8f5e9",
    color: colors.primary,
    fontSize: 11,
    fontWeight: "600",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceSecondary,
    paddingTop: 10,
  },
  bookButton: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  bookButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  mapButton: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  mapButtonText: {
    color: colors.text,
    fontSize: 13,
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
