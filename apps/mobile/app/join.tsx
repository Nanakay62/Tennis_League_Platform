import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { colors } from "../src/theme/colors";
import { API_BASE_URL, getPrograms, Program } from "../src/api/client";
import { getAccessToken } from "../src/lib/auth";

export default function JoinTodayScreen() {
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

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Join Frankfurt League</Text>
      <Text style={styles.subtitle}>
        Select your season packages. Pricing is calculated dynamically with all eligible credits applied.
      </Text>

      {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Available Programs</Text>
      </View>

      {programs.map((item) => {
        const isSelected = selectedIds.includes(item.id);
        return (
          <TouchableOpacity
            key={item.id}
            style={[styles.programRow, isSelected && styles.programRowActive]}
            onPress={() => toggleProgram(item.id)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
              {isSelected ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
            <View style={styles.programInfo}>
              <View style={styles.titleRow}>
                <Text style={styles.programName}>{item.name}</Text>
                <Text style={styles.priceTag}>€{(item.priceCents / 100).toFixed(2)}</Text>
              </View>
              <Text style={styles.programDates}>
                {item.startDate} to {item.endDate} • {item.status}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}

      {/* Quote summary card */}
      {quote && (
        <View style={styles.quoteCard}>
          <Text style={styles.quoteHeader}>Order Summary</Text>
          <View style={styles.quoteRow}>
            <Text style={styles.quoteLabel}>Subtotal</Text>
            <Text style={styles.quoteVal}>€{quote.subtotal.toFixed(2)}</Text>
          </View>
          {quote.discount > 0 && (
            <View style={styles.quoteRow}>
              <Text style={[styles.quoteLabel, styles.discountText]}>Credit Applied</Text>
              <Text style={[styles.quoteVal, styles.discountText]}>
                -€{quote.discount.toFixed(2)}
              </Text>
            </View>
          )}
          <View style={[styles.quoteRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Final Cost</Text>
            <Text style={styles.totalVal}>€{quote.finalCost.toFixed(2)}</Text>
          </View>

          <TouchableOpacity
            style={[styles.checkoutBtn, checkoutLoading && styles.btnDisabled]}
            onPress={handleCheckout}
            disabled={checkoutLoading}
            activeOpacity={0.8}
          >
            {checkoutLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.checkoutBtnText}>
                Pay with Stripe • €{quote.finalCost.toFixed(2)}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  errorText: {
    color: colors.danger,
    backgroundColor: "#ffebee",
    padding: 10,
    borderRadius: 6,
    marginBottom: 16,
    fontSize: 13,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  programRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  programRowActive: {
    borderColor: colors.primary,
    backgroundColor: "#f4fbf5",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
    backgroundColor: colors.surface,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "bold",
  },
  programInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  programName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  priceTag: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.primary,
  },
  programDates: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  quoteCard: {
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 16,
    marginBottom: 24,
  },
  quoteHeader: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 14,
  },
  quoteRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  quoteLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  quoteVal: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  discountText: {
    color: colors.success,
    fontWeight: "700",
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  totalVal: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.primary,
  },
  checkoutBtn: {
    height: 48,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  checkoutBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
