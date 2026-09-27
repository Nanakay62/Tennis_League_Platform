import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from "react-native";
import { colors } from "../theme/colors";
import { MIN_TOUCH_TARGET } from "../theme/tokens";
import { accessibleButtonProps } from "../lib/accessibility";

export interface AccessibleButtonProps {
  label: string;
  onPress: () => void;
  hint?: string;
  variant?: "primary" | "secondary" | "outline" | "danger";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function AccessibleButton({
  label,
  onPress,
  hint,
  variant = "primary",
  disabled = false,
  loading = false,
  style,
  textStyle,
}: AccessibleButtonProps) {
  const isOutline = variant === "outline";
  const isSecondary = variant === "secondary";
  const isDanger = variant === "danger";

  const btnStyle = [
    styles.base,
    variant === "primary" && styles.primary,
    isSecondary && styles.secondary,
    isOutline && styles.outline,
    isDanger && styles.danger,
    disabled && styles.disabled,
    style,
  ];

  const labelStyle = [
    styles.baseText,
    variant === "primary" && styles.primaryText,
    isSecondary && styles.secondaryText,
    isOutline && styles.outlineText,
    isDanger && styles.dangerText,
    disabled && styles.disabledText,
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={btnStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      {...accessibleButtonProps(label, hint)}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={isOutline || isSecondary ? colors.primary : "#ffffff"}
        />
      ) : (
        <Text style={labelStyle}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },
  baseText: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  primary: {
    backgroundColor: colors.primary,
  },
  primaryText: {
    color: "#ffffff",
  },
  secondary: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryText: {
    color: colors.text,
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  outlineText: {
    color: colors.primary,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  dangerText: {
    color: "#ffffff",
  },
  disabled: {
    opacity: 0.5,
  },
  disabledText: {
    color: colors.textMuted,
  },
});
