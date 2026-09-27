import React from "react";
import { View, Text, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useThemeColors } from "../../theme/colors";
import { Button } from "./Button";

export interface EmptyStateProps {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  message: string;
  action?: {
    label: string;
    href?: string;
    onPress?: () => void;
  };
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({
  icon = "info",
  title,
  message,
  action,
  style,
}: EmptyStateProps) {
  const { colors } = useThemeColors();

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: colors.surfaceMuted },
        ]}
      >
        <Feather name={icon} size={28} color={colors.textSecondary} />
      </View>

      <Text style={[styles.title, { color: colors.textPrimary }]}>
        {title}
      </Text>

      <Text style={[styles.message, { color: colors.textSecondary }]}>
        {message}
      </Text>

      {Boolean(action) && (
        <View style={styles.actionContainer}>
          <Button
            variant="primary"
            size="md"
            href={action?.href}
            onPress={action?.onPress}
          >
            {action?.label}
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    maxWidth: 320,
    marginBottom: 16,
  },
  actionContainer: {
    marginTop: 4,
  },
});
