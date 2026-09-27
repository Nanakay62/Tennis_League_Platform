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
import { Feather } from "@expo/vector-icons";
import { useThemeColors } from "../../src/theme/colors";
import { getCourts, Court } from "../../src/api/client";
import { AppShell, Card, Badge, Button, EmptyState } from "../../src/components";

export default function CourtsDirectoryScreen() {
  const { colors, isDark } = useThemeColors();
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

  const clearFilters = () => {
    setSelectedSurface(null);
    setFilterIndoor(null);
    setFilterLights(null);
    setFilterWall(null);
  };

  const renderItem = ({ item }: { item: Court }) => (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={[styles.courtName, { color: colors.textPrimary }]}>
            {item.name}
          </Text>
          <View style={styles.addressRow}>
            <Feather
              name="map-pin"
              size={12}
              color={colors.textSecondary}
              style={{ marginTop: 2, marginRight: 4 }}
            />
            <Text style={[styles.courtAddress, { color: colors.textSecondary }]}>
              {item.address}, {item.postal_code} {item.city}
            </Text>
          </View>
        </View>
        {item.average_rating > 0 ? (
          <Badge
            variant="warning"
            icon="star"
            label={`${item.average_rating.toFixed(1)}${
              item.review_count > 0 ? ` (${item.review_count})` : ""
            }`}
          />
        ) : (
          <Badge variant="neutral" label="New" />
        )}
      </View>

      {/* Surface & Amenities Badges */}
      <View style={styles.amenitiesRow}>
        <Badge
          variant="accent"
          size="sm"
          label={item.surface.toUpperCase()}
        />
        <Badge
          variant="neutral"
          size="sm"
          label={`${item.num_courts} Courts`}
        />
        {item.is_indoor && (
          <Badge variant="neutral" size="sm" label="Indoor" />
        )}
        {item.has_lights && (
          <Badge variant="neutral" size="sm" label="Floodlights" />
        )}
        {item.has_hitting_wall && (
          <Badge variant="neutral" size="sm" label="Hitting Wall" />
        )}
      </View>

      {/* Actions */}
      <View style={[styles.actionsRow, { borderTopColor: colors.borderSubtle }]}>
        {item.booking_url ? (
          <Button
            size="sm"
            variant="primary"
            iconRight="external-link"
            onPress={() => openBooking(item.booking_url)}
            accessibilityLabel={`Book court online at ${item.name}`}
          >
            Book Court
          </Button>
        ) : null}

        <Button
          size="sm"
          variant="secondary"
          iconRight="map-pin"
          onPress={() => openMap(item)}
          accessibilityLabel={`Get directions to ${item.name} in Google Maps`}
        >
          Directions
        </Button>
      </View>
    </Card>
  );

  const hasActiveFilters =
    selectedSurface !== null ||
    filterIndoor !== null ||
    filterLights !== null ||
    filterWall !== null;

  return (
    <AppShell title="COURTS">
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Frankfurt Courts
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Find tennis courts, surfaces, and booking details across Frankfurt.
        </Text>
      </View>

      {/* Filter Chips Bar */}
      <View
        style={[
          styles.filtersWrapper,
          {
            backgroundColor: colors.surface,
            borderColor: colors.borderSubtle,
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScroll}
        >
          <TouchableOpacity
            style={[
              styles.filterChip,
              {
                backgroundColor: !hasActiveFilters
                  ? colors.primary
                  : colors.surfaceMuted,
                borderColor: !hasActiveFilters
                  ? colors.primary
                  : colors.borderSubtle,
              },
            ]}
            onPress={clearFilters}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Filter by all courts"
          >
            <Text
              style={[
                styles.filterChipText,
                {
                  color: !hasActiveFilters
                    ? (isDark ? "#0d1413" : "#ffffff")
                    : colors.textSecondary,
                  fontWeight: !hasActiveFilters ? "700" : "500",
                },
              ]}
            >
              All Courts
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              {
                backgroundColor:
                  selectedSurface === "clay"
                    ? colors.primary
                    : colors.surfaceMuted,
                borderColor:
                  selectedSurface === "clay"
                    ? colors.primary
                    : colors.borderSubtle,
              },
            ]}
            onPress={() =>
              setSelectedSurface(selectedSurface === "clay" ? null : "clay")
            }
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Filter by clay surface"
          >
            <Text
              style={[
                styles.filterChipText,
                {
                  color:
                    selectedSurface === "clay"
                      ? (isDark ? "#0d1413" : "#ffffff")
                      : colors.textSecondary,
                  fontWeight: selectedSurface === "clay" ? "700" : "500",
                },
              ]}
            >
              Clay (Sand)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              {
                backgroundColor:
                  selectedSurface === "hard"
                    ? colors.primary
                    : colors.surfaceMuted,
                borderColor:
                  selectedSurface === "hard"
                    ? colors.primary
                    : colors.borderSubtle,
              },
            ]}
            onPress={() =>
              setSelectedSurface(selectedSurface === "hard" ? null : "hard")
            }
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Filter by hard court surface"
          >
            <Text
              style={[
                styles.filterChipText,
                {
                  color:
                    selectedSurface === "hard"
                      ? (isDark ? "#0d1413" : "#ffffff")
                      : colors.textSecondary,
                  fontWeight: selectedSurface === "hard" ? "700" : "500",
                },
              ]}
            >
              Hard Court
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              {
                backgroundColor:
                  selectedSurface === "carpet"
                    ? colors.primary
                    : colors.surfaceMuted,
                borderColor:
                  selectedSurface === "carpet"
                    ? colors.primary
                    : colors.borderSubtle,
              },
            ]}
            onPress={() =>
              setSelectedSurface(selectedSurface === "carpet" ? null : "carpet")
            }
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Filter by carpet surface"
          >
            <Text
              style={[
                styles.filterChipText,
                {
                  color:
                    selectedSurface === "carpet"
                      ? (isDark ? "#0d1413" : "#ffffff")
                      : colors.textSecondary,
                  fontWeight: selectedSurface === "carpet" ? "700" : "500",
                },
              ]}
            >
              Carpet / Teppich
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              {
                backgroundColor:
                  filterIndoor === true ? colors.primary : colors.surfaceMuted,
                borderColor:
                  filterIndoor === true
                    ? colors.primary
                    : colors.borderSubtle,
              },
            ]}
            onPress={() => setFilterIndoor(filterIndoor === true ? null : true)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Filter by indoor courts"
          >
            <Text
              style={[
                styles.filterChipText,
                {
                  color:
                    filterIndoor === true
                      ? (isDark ? "#0d1413" : "#ffffff")
                      : colors.textSecondary,
                  fontWeight: filterIndoor === true ? "700" : "500",
                },
              ]}
            >
              Halle / Indoor
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              {
                backgroundColor:
                  filterLights === true ? colors.primary : colors.surfaceMuted,
                borderColor:
                  filterLights === true
                    ? colors.primary
                    : colors.borderSubtle,
              },
            ]}
            onPress={() => setFilterLights(filterLights === true ? null : true)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Filter by courts with floodlights"
          >
            <Text
              style={[
                styles.filterChipText,
                {
                  color:
                    filterLights === true
                      ? (isDark ? "#0d1413" : "#ffffff")
                      : colors.textSecondary,
                  fontWeight: filterLights === true ? "700" : "500",
                },
              ]}
            >
              Floodlights
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              {
                backgroundColor:
                  filterWall === true ? colors.primary : colors.surfaceMuted,
                borderColor:
                  filterWall === true ? colors.primary : colors.borderSubtle,
              },
            ]}
            onPress={() => setFilterWall(filterWall === true ? null : true)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Filter by courts with hitting wall"
          >
            <Text
              style={[
                styles.filterChipText,
                {
                  color:
                    filterWall === true
                      ? (isDark ? "#0d1413" : "#ffffff")
                      : colors.textSecondary,
                  fontWeight: filterWall === true ? "700" : "500",
                },
              ]}
            >
              Hitting Wall
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Courts List */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Finding Frankfurt courts...
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
            Unable to load courts directory.
          </Text>
          <Button variant="secondary" size="sm" onPress={() => refetch()}>
            Retry
          </Button>
        </View>
      ) : (
        <FlatList
          data={courts || []}
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
              icon="map-pin"
              title="No courts match these filters"
              message="Try clearing some filter tags to see more courts."
              action={{
                label: "Clear Filters",
                onPress: clearFilters,
              }}
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
  filtersWrapper: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    marginBottom: 16,
  },
  filtersScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  filterChip: {
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  filterChipText: {
    fontSize: 13,
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
    alignItems: "flex-start",
    marginBottom: 10,
  },
  courtName: {
    fontSize: 16,
    fontWeight: "700",
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 4,
  },
  courtAddress: {
    fontSize: 13,
    flexShrink: 1,
    lineHeight: 18,
  },
  amenitiesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginVertical: 10,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
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
