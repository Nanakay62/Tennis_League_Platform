import React from "react";
import {
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  TextStyle,
} from "react-native";
import { Link } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useThemeColors } from "../../theme/colors";
import { MIN_TOUCH_TARGET } from "../../theme/tokens";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  onPress?: () => void;
  href?: string;
  icon?: keyof typeof Feather.glyphMap;
  iconRight?: keyof typeof Feather.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  onPress,
  href,
  icon,
  iconRight,
  disabled = false,
  loading = false,
  style,
  textStyle,
  accessibilityLabel,
}: ButtonProps) {
  const { colors, isDark } = useThemeColors();

  // Variant-specific styles
  let bgColor = colors.primary;
  let textColor = isDark ? "#0d1413" : "#ffffff";
  let borderColor = "transparent";
  let borderWidth = 0;

  if (variant === "secondary") {
    bgColor = colors.surface;
    textColor = colors.textPrimary;
    borderColor = colors.border;
    borderWidth = 1;
  } else if (variant === "ghost") {
    bgColor = "transparent";
    textColor = colors.primary;
  } else if (variant === "danger") {
    bgColor = colors.danger;
    textColor = "#ffffff";
  }

  // Size-specific styles
  let minHeight = MIN_TOUCH_TARGET;
  let paddingHorizontal = 16;
  let paddingVertical = 10;
  let fontSize = 13;

  if (size === "sm") {
    minHeight = 36;
    paddingHorizontal = 12;
    paddingVertical = 6;
    fontSize = 12;
  } else if (size === "lg") {
    minHeight = 48;
    paddingHorizontal = 20;
    paddingVertical = 12;
    fontSize = 15;
  }

  const buttonStyle = StyleSheet.flatten([
    styles.button,
    {
      backgroundColor: bgColor,
      borderColor,
      borderWidth,
      minHeight,
      paddingHorizontal,
      paddingVertical,
      opacity: disabled || loading ? 0.6 : 1,
    },
    style,
  ]);

  const resolvedTextStyle = StyleSheet.flatten([
    styles.text,
    {
      color: textColor,
      fontSize,
    },
    textStyle,
  ]);

  const content = (
    <>
      {loading ? (
        <ActivityIndicator size="small" color={textColor} style={{ marginRight: 6 }} />
      ) : icon ? (
        <Feather
          name={icon}
          size={fontSize + 1}
          color={textColor}
          style={{ marginRight: 6 }}
        />
      ) : null}

      <Text style={resolvedTextStyle}>{children}</Text>

      {!loading && iconRight && (
        <Feather
          name={iconRight}
          size={fontSize + 1}
          color={textColor}
          style={{ marginLeft: 6 }}
        />
      )}
    </>
  );

  if (href && !disabled) {
    return (
      <Link href={href as any} asChild>
        <TouchableOpacity
          style={buttonStyle}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel || (typeof children === "string" ? children : undefined)}
        >
          {content}
        </TouchableOpacity>
      </Link>
    );
  }

  return (
    <TouchableOpacity
      style={buttonStyle}
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || (typeof children === "string" ? children : undefined)}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  text: {
    fontWeight: "700",
    letterSpacing: -0.1,
  },
});
