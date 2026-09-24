import React from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from "react-native";
import { useLocalSearchParams, Link } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getProgramDivisions } from "../../src/api/client";
import { colors } from "../../src/theme/colors";

export default function ProgramDivisionsScreen() {
  const { programId } = useLocalSearchParams<{ programId: string }>();

  const { data: divisions, refetch, isRefetching } = useQuery({
    queryKey: ["divisions", programId],
    queryFn: () => getProgramDivisions(programId || "default"),
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Your Division</Text>
      <Text style={styles.subtitle}>
        View current standings, match results, and rosters.
      </Text>

      <FlatList
        data={divisions}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        renderItem={({ item }) => (
          <Link href={`/divisions/${item.id}`} asChild>
            <TouchableOpacity style={styles.rowCard} activeOpacity={0.7}>
              <View>
                <Text style={styles.divisionName}>{item.name}</Text>
                <Text style={styles.divisionDetails}>
                  NTRP {item.ratingBand} • {item.playersCount} Enrolled Players
                </Text>
              </View>
              <Text style={styles.arrow}>View Standings →</Text>
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
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  rowCard: {
    backgroundColor: colors.surface,
    padding: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  divisionName: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 2,
  },
  divisionDetails: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  arrow: {
    color: colors.primary,
    fontWeight: "600",
    fontSize: 14,
  },
});
