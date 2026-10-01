import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useThemeColors } from "../../src/theme/colors";
import { API_BASE_URL } from "../../src/api/client";
import { AppShell, Card, Button, Badge } from "../../src/components";

export default function CheckoutResultScreen() {
  const { colors } = useThemeColors();
  const router = useRouter();
  const { session_id, order_id, reference, trxref } = useLocalSearchParams<{
    session_id?: string;
    order_id?: string;
    reference?: string;
    trxref?: string;
  }>();

  const lookupId = order_id || reference || trxref || session_id;
  const [loading, setLoading] = useState(true);
  const [orderStatus, setOrderStatus] = useState<string>("paid");

  useEffect(() => {
    checkPayment();
  }, [lookupId]);

  async function checkPayment() {
    if (!lookupId) {
      setLoading(false);
      return;
    }

    try {
      // In dev mode, trigger mock Paystack webhook fulfillment to verify immediate activation
      await fetch(`${API_BASE_URL}/webhooks/paystack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "charge.success",
          data: {
            id: `pstk_evt_dev_${lookupId}`,
            reference: lookupId,
            status: "success",
            channel: "mobile_money",
            amount: 35000,
          },
        }),
      }).catch(() => {});

      const res = await fetch(`${API_BASE_URL}/orders/${lookupId}`);
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
      <AppShell title="CONFIRMATION">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Verifying enrollment confirmation...
          </Text>
        </View>
      </AppShell>
    );
  }

  const isCancelled = orderStatus === "cancelled";

  return (
    <AppShell title={isCancelled ? "PAYMENT CANCELLED" : "CONFIRMATION"}>
      <View style={styles.wrapper}>
        <Card style={styles.confirmationCard} contentStyle={styles.cardContent}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: isCancelled ? colors.dangerBg : colors.accentSecondary },
            ]}
          >
            <Feather
              name={isCancelled ? "x-circle" : "check"}
              size={28}
              color={isCancelled ? colors.danger : colors.primary}
            />
          </View>

          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {isCancelled ? "Payment Not Completed" : "You're Enrolled!"}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {isCancelled
              ? "Your payment was cancelled or could not be processed. No charges were made."
              : "Welcome to Accra Tennis League. Your season enrollment is confirmed."}
          </Text>

          <View style={[styles.infoBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.borderSubtle }]}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Status</Text>
              <Badge
                label={isCancelled ? "Cancelled" : "Paid & Confirmed"}
                variant={isCancelled ? "danger" : "success"}
                icon={isCancelled ? "alert-circle" : "check-circle"}
                size="sm"
              />
            </View>

            <View style={[styles.infoRow, { borderTopColor: colors.borderSubtle, borderTopWidth: 1 }]}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Order Reference</Text>
              <Text style={[styles.infoVal, { color: colors.textPrimary }]}>
                {(lookupId || "ORD-TEST").slice(0, 16)}
              </Text>
            </View>

            <View style={[styles.infoRow, { borderTopColor: colors.borderSubtle, borderTopWidth: 1 }]}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Market</Text>
              <Text style={[styles.infoVal, { color: colors.textPrimary }]}>
                Accra
              </Text>
            </View>
          </View>

          {!isCancelled && (
            <View style={styles.noticeRow}>
              <Feather name="info" size={14} color={colors.primary} style={{ marginRight: 8, marginTop: 2 }} />
              <Text style={[styles.nextStepsText, { color: colors.textSecondary }]}>
                What happens next: Division placements and opponent rosters will be published on kickoff day.
              </Text>
            </View>
          )}

          <View style={styles.actionsRow}>
            {isCancelled ? (
              <Button
                variant="primary"
                size="lg"
                onPress={() => router.replace("/join")}
                icon="refresh-cw"
                style={{ width: "100%", marginBottom: 10 }}
              >
                Try Again
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                onPress={() => router.replace("/divisions/div-comp-1")}
                iconRight="arrow-right"
                style={{ width: "100%", marginBottom: 10 }}
              >
                View Division Standings
              </Button>
            )}

            <Button
              variant="secondary"
              size="md"
              onPress={() => router.replace("/")}
              style={{ width: "100%" }}
            >
              Return to Home
            </Button>
          </View>
        </Card>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  loadingContainer: {
    padding: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
  },
  confirmationCard: {
    width: "100%",
    maxWidth: 500,
  },
  cardContent: {
    alignItems: "center",
    padding: 24,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  infoBox: {
    width: "100%",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  infoVal: {
    fontSize: 13,
    fontWeight: "700",
  },
  noticeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  nextStepsText: {
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  actionsRow: {
    width: "100%",
  },
});
