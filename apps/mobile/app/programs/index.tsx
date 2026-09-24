import React from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { getPrograms } from "../../src/api/client";
import { colors } from "../../src/theme/colors";

export default function ProgramsScreen() {
  const { data: programs, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["programs"],
    queryFn: getPrograms,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Available Seasons & Programs</Text>
      <Text style={styles.headerSubtitle}>
        Join an upcoming flex season or view current standings.
      </Text>

      <FlatList
        data={programs}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        renderItem={({ item }) => (
          <Link href={`/programs/${item.id}`} asChild>
            <TouchableOpacity style={styles.card} activeOpacity={0.7}>
              <View style={styles.cardHeader}>
                <Text style={styles.statusBadge}>{item.status}</Text>
                <Text style={styles.price}>
                  €{(item.priceCents / 100).toFixed(2)}
                </Text>
              </View>
              <Text style={styles.programName}>{item.name}</Text>
              <Text style={styles.dates}>
                📅 {item.startDate} to {item.endDate}
              </Text>
              <View style={styles.cardFooter}>
                <Text style={styles.viewDivisions}>Select Division →</Text>
              </View>
            </TouchableOpacity>
          </Link>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    maxWidth: 900,
    width: "100%",
    alignSelf: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  card: {
    backgroundColor: colors.surface,
    padding: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  statusBadge: {
    backgroundColor: colors.badgeBg,
    color: colors.badgeText,
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  price: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary,
  },
  programName: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  dates: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    alignItems: "flex-end",
  },
  viewDivisions: {
    color: colors.primary,
    fontWeight: "600",
    fontSize: 14,
  },
});
