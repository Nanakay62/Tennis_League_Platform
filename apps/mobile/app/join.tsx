import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Feather } from "@expo/vector-icons";
import { useThemeColors } from "../src/theme/colors";
import { API_BASE_URL, getPrograms, Program } from "../src/api/client";
import { getAccessToken } from "../src/lib/auth";
import { AppShell, Card, Button, Badge } from "../src/components";

export default function JoinTodayScreen() {
  const { colors } = useThemeColors();
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [quote, setQuote] = useState<{
    subtotal: number;
    discount: number;
    finalCost: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    loadPrograms();
  }, []);

  useEffect(() => {
    if (selectedIds.length > 0) {
      fetchQuote();
    } else {
      setQuote(null);
    }
  }, [selectedIds]);

  async function loadPrograms() {
    setLoading(true);
    try {
      const data = await getPrograms();
      setPrograms(data);
      if (data.length > 0) {
        setSelectedIds([data[0].id]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchQuote() {
    try {
      const res = await fetch(`${API_BASE_URL}/cart/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ program_ids: selectedIds }),
      });
      if (res.ok) {
        const data = await res.json();
        setQuote({
          subtotal: data.subtotal_cents / 100,
          discount: data.discount_cents / 100,
          finalCost: data.final_cost_cents / 100,
        });
      }
    } catch {}
  }

  function toggleProgram(id: string) {
    if (selectedIds.includes(id)) {
      if (selectedIds.length > 1) {
        setSelectedIds(selectedIds.filter((p) => p !== id));
      }
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  }

  async function handleCheckout() {
    const token = await getAccessToken();
    if (!token) {
      router.push("/(auth)/login");
      return;
    }

    setCheckoutLoading(true);
    setErrorMsg("");

    try {
      const successUrl =
        Platform.OS === "web"
          ? `${window.location.origin}/checkout/result?session_id={CHECKOUT_SESSION_ID}`
          : "tennisleague://checkout/result?session_id={CHECKOUT_SESSION_ID}";

      const res = await fetch(`${API_BASE_URL}/checkout/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          program_ids: selectedIds,
          success_url: successUrl,
          cancel_url: `${API_BASE_URL}/join`,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Could not initialize checkout.");
      }

      const sessionData = await res.json();

      if (Platform.OS === "web") {
        router.push(
          `/checkout/result?session_id=${sessionData.session_id}&order_id=${sessionData.order_id}`
        );
      } else {
        await WebBrowser.openBrowserAsync(sessionData.checkout_url);
        router.push(
          `/checkout/result?session_id=${sessionData.session_id}&order_id=${sessionData.order_id}`
        );
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to proceed to checkout.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  return (
    <AppShell title="JOIN TODAY" showBack>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Join Accra League
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Select your season package. Guaranteed minimum 6 playing partners.
        </Text>
      </View>

      {errorMsg ? (
        <View style={[styles.errorBox, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}>
          <Feather name="alert-triangle" size={16} color={colors.danger} style={{ marginRight: 8 }} />
          <Text style={[styles.errorText, { color: colors.danger }]}>{errorMsg}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={styles.contentWrap}>
          {/* Programs selection list */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            Available Seasons
          </Text>

          {programs.map((item) => {
            const isSelected = selectedIds.includes(item.id);

            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.programCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                  isSelected && { borderWidth: 2 },
                ]}
                onPress={() => toggleProgram(item.id)}
                activeOpacity={0.8}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected ? colors.primary : "transparent",
                    },
                  ]}
                >
                  {isSelected ? <Feather name="check" size={14} color="#ffffff" /> : null}
                </View>

                <View style={styles.programDetails}>
                  <View style={styles.programTitleRow}>
                    <Text
                      style={[styles.programName, { color: colors.textPrimary }]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text style={[styles.priceTag, { color: colors.primary }]}>
                      GH₵ {(item.priceCents / 100).toFixed(2)}
                    </Text>
                  </View>

                  <View style={styles.programMetaRow}>
                    <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                      {item.startDate} to {item.endDate}
                    </Text>
                    <Badge label={item.status} variant="success" size="sm" />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Order Summary & Checkout Card */}
          {quote && (
            <Card title="Order Summary" style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Subtotal</Text>
                <Text style={[styles.summaryVal, { color: colors.textPrimary }]}>
                  GH₵ {quote.subtotal.toFixed(2)}
                </Text>
              </View>

              {quote.discount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.success }]}>
                    Credit / Discount Applied
                  </Text>
                  <Text style={[styles.summaryVal, { color: colors.success }]}>
                    -GH₵ {quote.discount.toFixed(2)}
                  </Text>
                </View>
              )}

              <View style={[styles.totalRow, { borderTopColor: colors.borderSubtle }]}>
                <Text style={[styles.totalLabel, { color: colors.textPrimary }]}>Final Cost</Text>
                <Text style={[styles.totalVal, { color: colors.primary }]}>
                  GH₵ {quote.finalCost.toFixed(2)}
                </Text>
              </View>

              <Button
                variant="primary"
                size="lg"
                onPress={handleCheckout}
                loading={checkoutLoading}
                icon="credit-card"
                style={styles.checkoutBtn}
              >
                Pay with MoMo / Card • GH₵ {quote.finalCost.toFixed(2)}
              </Button>
            </Card>
          )}
        </View>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: "500",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  loadingBox: {
    padding: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  contentWrap: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  programCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  programDetails: {
    flex: 1,
  },
  programTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  programName: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
    marginRight: 8,
  },
  priceTag: {
    fontSize: 16,
    fontWeight: "800",
  },
  programMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  metaText: {
    fontSize: 12,
    fontWeight: "500",
  },
  summaryCard: {
    marginTop: 8,
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  summaryVal: {
    fontSize: 14,
    fontWeight: "600",
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    marginTop: 6,
    borderTopWidth: 1,
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  totalVal: {
    fontSize: 22,
    fontWeight: "800",
  },
  checkoutBtn: {
    width: "100%",
  },
});
