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
import { useThemeColors } from "../../theme/colors";

export interface CardProps {
  title?: string;
  actionLink?: {
    label: string;
    href: string;
  };
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  noPadding?: boolean;
}

export function Card({
  title,
  actionLink,
  children,
  style,
  contentStyle,
  noPadding = false,
}: CardProps) {
  const { colors } = useThemeColors();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {Boolean(title || actionLink) && (
        <View
          style={[
            styles.headerRow,
            { borderBottomColor: colors.borderSubtle },
          ]}
        >
          {Boolean(title) && (
            <Text
              style={[
                styles.title,
                { color: colors.textPrimary },
              ]}
            >
              {title}
            </Text>
          )}

          {Boolean(actionLink) && (
            <Link href={actionLink!.href as any} asChild>
              <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text
                  style={[
                    styles.actionText,
                    { color: colors.primary },
                  ]}
                >
                  {actionLink!.label}
                </Text>
              </TouchableOpacity>
            </Link>
          )}
        </View>
      )}

      <View style={[!noPadding && styles.defaultPadding, contentStyle]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  defaultPadding: {
    padding: 16,
  },
});
