import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { colors } from "../theme/colors";
import { accessibleButtonProps } from "../lib/accessibility";

interface OfflineBannerProps {
  isOffline?: boolean;
  message?: string;
}

export function OfflineBanner({
  isOffline = false,
  message = "📡 Offline Mode • Viewing cached league data",
}: OfflineBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!isOffline || dismissed) {
    return null;
  }

  return (
    <View
      style={styles.banner}
      accessible={true}
      accessibilityRole="alert"
      accessibilityLabel={message}
    >
      <Text style={styles.text}>{message}</Text>
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={() => setDismissed(true)}
        {...accessibleButtonProps("Dismiss offline alert", "Closes the offline notification banner")}
      >
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#fff3e0",
    borderBottomWidth: 1,
    borderBottomColor: "#ffe0b2",
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  text: {
    fontSize: 13,
    color: "#e65100",
    fontWeight: "600",
    flex: 1,
  },
  closeBtn: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  closeText: {
    fontSize: 14,
    color: "#e65100",
    fontWeight: "700",
  },
});
