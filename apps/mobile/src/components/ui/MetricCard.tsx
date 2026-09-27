import React from "react";
import { View, Text, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { useThemeColors } from "../../theme/colors";

export interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  progress?: {
    current: number;
    total: number;
    label?: string;
  };
  style?: StyleProp<ViewStyle>;
}

export function MetricCard({
  label,
  value,
  subtext,
  progress,
  style,
}: MetricCardProps) {
  const { colors } = useThemeColors();

  const progressPercent = progress
    ? Math.min(Math.max((progress.current / progress.total) * 100, 0), 100)
    : 0;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: colors.textSecondary },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>

      <Text
        style={[
          styles.value,
          { color: colors.textPrimary },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>

      {Boolean(subtext) && (
        <Text
          style={[
            styles.subtext,
            { color: colors.textSecondary },
          ]}
          numberOfLines={1}
        >
          {subtext}
        </Text>
      )}

      {Boolean(progress) && (
        <View style={styles.progressContainer}>
          <View
            style={[
              styles.progressBarBg,
              { backgroundColor: colors.surfaceMuted },
            ]}
          >
            <View
              style={[
                styles.progressBarFill,
                {
                  backgroundColor: colors.primary,
                  width: `${progressPercent}%`,
                },
              ]}
            />
          </View>
          {Boolean(progress?.label) && (
            <Text
              style={[
                styles.progressLabel,
                { color: colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              {progress?.label}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    minWidth: 120,
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  value: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtext: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: "500",
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBarBg: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 4,
  },
});
