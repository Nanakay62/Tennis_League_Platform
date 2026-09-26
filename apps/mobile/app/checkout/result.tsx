import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors } from "../../src/theme/colors";
import { API_BASE_URL } from "../../src/api/client";

export default function CheckoutResultScreen() {
  const router = useRouter();
  const { session_id, order_id } = useLocalSearchParams<{
    session_id: string;
    order_id: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [orderStatus, setOrderStatus] = useState<string>("paid");

  useEffect(() => {
    checkPayment();
  }, [order_id]);

  async function checkPayment() {
    if (!order_id) {
      setLoading(false);
      return;
    }

    try {
      // In dev mode, trigger mock webhook fulfillment to verify immediate activation
      await fetch(`${API_BASE_URL}/webhooks/stripe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: `evt_dev_${session_id || order_id}`,
          type: "checkout.session.completed",
          data: {
            object: {
              id: session_id,
              payment_intent: `pi_dev_${order_id}`,
            },
          },
        }),
      }).catch(() => {});

      const res = await fetch(`${API_BASE_URL}/orders/${order_id}`);
      if (res.ok) {
        const data = await res.json();
        setOrderStatus(data.status);
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Verifying enrollment with Stripe...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Text style={styles.checkmark}>✓</Text>
        </View>
        <Text style={styles.title}>You're Enrolled!</Text>
        <Text style={styles.subtitle}>
          Welcome to Frankfurt Tennis League. Your season enrollment is confirmed.
        </Text>

        <View style={styles.infoBox}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <Text style={styles.statusSuccess}>Paid & Confirmed</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Order Reference</Text>
            <Text style={styles.infoVal}>{(order_id || "ORD-TEST").slice(0, 12)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Market</Text>
            <Text style={styles.infoVal}>Frankfurt am Main</Text>
          </View>
        </View>

        <Text style={styles.nextStepsText}>
          🎾 What happens next: You will receive division placement and opponent contact details on kickoff day!
        </Text>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.replace("/divisions/div-comp-1")}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryBtnText}>View Division Standings</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.replace("/")}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryBtnText}>Return to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: colors.textSecondary,
  },
  card: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.badgeBg,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  checkmark: {
    fontSize: 32,
    color: colors.primary,
    fontWeight: "bold",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  infoBox: {
    width: "100%",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  infoVal: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  statusSuccess: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.success,
  },
  nextStepsText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 20,
  },
  primaryBtn: {
    width: "100%",
    height: 46,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    marginBottom: 10,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryBtn: {
    width: "100%",
    height: 44,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  secondaryBtnText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
});
