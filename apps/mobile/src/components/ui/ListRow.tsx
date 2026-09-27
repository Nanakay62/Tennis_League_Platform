import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
} from "react-native";
import { Link } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useThemeColors } from "../../theme/colors";
import { MIN_TOUCH_TARGET } from "../../theme/tokens";

export interface ListRowProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  badge?: string;
  href?: string;
  onPress?: () => void;
  isLast?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ListRow({
  icon,
  title,
  subtitle,
  badge,
  href,
  onPress,
  isLast = false,
  style,
}: ListRowProps) {
  const { colors } = useThemeColors();

  const content = (
    <View
      style={[
        styles.rowContent,
        !isLast && { borderBottomColor: colors.borderSubtle, borderBottomWidth: 1 },
      ]}
    >
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: colors.accentSecondary },
        ]}
      >
        <Feather name={icon} size={16} color={colors.primary} />
      </View>

      <View style={styles.textContainer}>
        <Text
          style={[styles.title, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {Boolean(subtitle) && (
          <Text
            style={[styles.subtitle, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>

      {Boolean(badge) && (
        <View
          style={[
            styles.badge,
            { backgroundColor: colors.accentSecondary },
          ]}
        >
          <Text style={[styles.badgeText, { color: colors.primary }]}>
            {badge}
          </Text>
        </View>
      )}

      <Feather name="chevron-right" size={16} color={colors.textMuted} />
    </View>
  );

  const containerStyle = StyleSheet.flatten([
    styles.container,
    { backgroundColor: colors.surface },
    style,
  ]);

  if (href) {
    return (
      <Link href={href as any} asChild>
        <TouchableOpacity
          style={containerStyle}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={title}
        >
          {content}
        </TouchableOpacity>
      </Link>
    );
  }

  return (
    <TouchableOpacity
      style={containerStyle}
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: "center",
  },
  rowContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
