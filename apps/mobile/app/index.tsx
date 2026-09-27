import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Link } from "expo-router";
import { colors } from "../src/theme/colors";

export default function HomeScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.badge}>FRANKFURT AM MAIN</Text>
        <Text style={styles.title}>Frankfurt Flex Tennis League</Text>
        <Text style={styles.subtitle}>
          Play competitive flex matches on your own schedule across Frankfurt courts.
        </Text>
      </View>

      <View style={styles.grid}>
        <Link href="/programs" asChild>
          <TouchableOpacity style={styles.actionCard} activeOpacity={0.8}>
            <Text style={styles.actionIcon}>🎾</Text>
            <Text style={styles.actionTitle}>Browse Programs</Text>
            <Text style={styles.actionDesc}>Explore Fall Season & Divisions</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/divisions/div-comp-1" asChild>
          <TouchableOpacity style={styles.actionCard} activeOpacity={0.8}>
            <Text style={styles.actionIcon}>📊</Text>
            <Text style={styles.actionTitle}>Competitive Standings</Text>
            <Text style={styles.actionDesc}>3.5 Division live tables</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/scores" asChild>
          <TouchableOpacity style={styles.actionCard} activeOpacity={0.8}>
            <Text style={styles.actionIcon}>⚡</Text>
            <Text style={styles.actionTitle}>Latest Results</Text>
            <Text style={styles.actionDesc}>Live match results feed</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/scores/submit" asChild>
          <TouchableOpacity style={styles.actionCard} activeOpacity={0.8}>
            <Text style={styles.actionIcon}>📝</Text>
            <Text style={styles.actionTitle}>Report Score</Text>
            <Text style={styles.actionDesc}>Submit sets & validate</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/partners" asChild>
          <TouchableOpacity style={styles.actionCard} activeOpacity={0.8}>
            <Text style={styles.actionIcon}>🤝</Text>
            <Text style={styles.actionTitle}>Practice Partners</Text>
            <Text style={styles.actionDesc}>Match NTRP & earn €5 monthly</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/courts" asChild>
          <TouchableOpacity style={styles.actionCard} activeOpacity={0.8}>
            <Text style={styles.actionIcon}>📍</Text>
            <Text style={styles.actionTitle}>Frankfurt Courts</Text>
            <Text style={styles.actionDesc}>Directory, surfaces & lighting</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/community/poty" asChild>
          <TouchableOpacity style={styles.actionCard} activeOpacity={0.8}>
            <Text style={styles.actionIcon}>🏆</Text>
            <Text style={styles.actionTitle}>Player of the Year</Text>
            <Text style={styles.actionDesc}>Leaderboard & referral rewards</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/join" asChild>
          <TouchableOpacity style={[styles.actionCard, { borderColor: colors.primary }]} activeOpacity={0.8}>
            <Text style={styles.actionIcon}>🛒</Text>
            <Text style={[styles.actionTitle, { color: colors.primary }]}>Join Today</Text>
            <Text style={styles.actionDesc}>Enroll in Fall Season • €34.95</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/account" asChild>
          <TouchableOpacity style={styles.actionCard} activeOpacity={0.8}>
            <Text style={styles.actionIcon}>👤</Text>
            <Text style={styles.actionTitle}>My Account</Text>
            <Text style={styles.actionDesc}>Profile, ratings & notifications</Text>
          </TouchableOpacity>
        </Link>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>How it works</Text>
        <Text style={styles.infoText}>1. Enroll in your skill division.</Text>
        <Text style={styles.infoText}>2. Contact division opponents and book courts.</Text>
        <Text style={styles.infoText}>3. Winner reports scores; standings update live.</Text>
        <Text style={styles.infoText}>4. Top players qualify for Frankfurt playoffs!</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    maxWidth: 900,
    alignSelf: "center",
    width: "100%",
  },
  heroCard: {
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.badgeBg,
    color: colors.badgeText,
    fontWeight: "700",
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 20,
  },
  actionCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 1,
  },
  actionIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  actionDesc: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  infoBox: {
    backgroundColor: colors.surfaceSecondary,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 6,
    lineHeight: 20,
  },
});
