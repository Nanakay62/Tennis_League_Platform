import React from "react";
import { View, Text, StyleSheet, StyleProp, ViewStyle, TextStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useThemeColors } from "../../theme/colors";

export type BadgeVariant = "success" | "neutral" | "warning" | "danger" | "accent";

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  icon?: keyof typeof Feather.glyphMap;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function Badge({
  label,
  variant = "neutral",
  size = "md",
  icon,
  style,
  textStyle,
}: BadgeProps) {
  const { colors } = useThemeColors();

  let bgColor = colors.surfaceMuted;
  let textColor = colors.textSecondary;

  if (variant === "success") {
    bgColor = colors.successBg;
    textColor = colors.successText;
  } else if (variant === "warning") {
    bgColor = colors.warningBg;
    textColor = colors.warningText;
  } else if (variant === "danger") {
    bgColor = colors.dangerBg;
    textColor = colors.dangerText;
  } else if (variant === "accent") {
    bgColor = colors.accentSecondary;
    textColor = colors.primary;
  }

  const isSmall = size === "sm";

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bgColor,
          paddingHorizontal: isSmall ? 6 : 8,
          paddingVertical: isSmall ? 2 : 3,
        },
        style,
      ]}
    >
      {Boolean(icon) && (
        <Feather
          name={icon!}
          size={isSmall ? 9 : 11}
          color={textColor}
          style={{ marginRight: 3 }}
        />
      )}
      <Text
        style={[
          styles.text,
          {
            color: textColor,
            fontSize: isSmall ? 10 : 11,
          },
          textStyle,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
});
