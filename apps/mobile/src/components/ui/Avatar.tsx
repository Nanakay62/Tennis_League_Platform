import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useThemeColors } from "../../theme/colors";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | number;

export interface AvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  size?: AvatarSize;
  showEditBadge?: boolean;
  onEditPress?: () => void;
  isLoading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const SIZE_MAP: Record<"xs" | "sm" | "md" | "lg" | "xl", number> = {
  xs: 24,
  sm: 34,
  md: 40,
  lg: 64,
  xl: 80,
};

export const FONT_SIZE_MAP: Record<"xs" | "sm" | "md" | "lg" | "xl", number> = {
  xs: 10,
  sm: 13,
  md: 15,
  lg: 22,
  xl: 28,
};

export function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return "P";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 1).toUpperCase();
  }
  const first = parts[0].substring(0, 1).toUpperCase();
  const last = parts[parts.length - 1].substring(0, 1).toUpperCase();
  return `${first}${last}`;
}

export function Avatar({
  name,
  avatarUrl,
  size = "md",
  showEditBadge = false,
  onEditPress,
  isLoading = false,
  style,
}: AvatarProps) {
  const { colors } = useThemeColors();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const dimension = typeof size === "number" ? size : SIZE_MAP[size] || SIZE_MAP.md;
  const fontSize = typeof size === "number" ? Math.round(size * 0.36) : FONT_SIZE_MAP[size] || FONT_SIZE_MAP.md;
  const borderRadius = Math.round(dimension / 2);
  const initials = getInitials(name);

  const hasValidImage = Boolean(avatarUrl && avatarUrl.trim() && failedUrl !== avatarUrl);

  const containerStyle: ViewStyle = {
    width: dimension,
    height: dimension,
    borderRadius,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: hasValidImage ? colors.surfaceMuted : colors.accentSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  };

  const badgeSize = Math.max(20, Math.round(dimension * 0.35));
  const badgeRadius = Math.round(badgeSize / 2);
  const iconSize = Math.max(11, Math.round(badgeSize * 0.55));

  return (
    <View style={[{ width: dimension, height: dimension, position: "relative" }, style]}>
      <View style={containerStyle}>
        {hasValidImage ? (
          <Image
            source={{ uri: avatarUrl! }}
            style={{ width: dimension, height: dimension, borderRadius }}
            onError={() => setFailedUrl(avatarUrl ?? null)}
            accessibilityRole="image"
            accessibilityLabel={name ? `${name}'s profile photo` : "Profile photo"}
          />
        ) : (
          <Text
            style={[
              styles.initialsText,
              {
                fontSize,
                color: colors.primary,
              },
            ]}
            numberOfLines={1}
          >
            {initials}
          </Text>
        )}

        {isLoading && (
          <View style={[styles.loadingOverlay, { borderRadius }]}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}
      </View>

      {showEditBadge && (
        <TouchableOpacity
          style={[
            styles.editBadge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeRadius,
              backgroundColor: colors.primary,
              borderColor: colors.surface,
            },
          ]}
          onPress={onEditPress}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Change profile picture"
        >
          <Feather name="camera" size={iconSize} color="#ffffff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  initialsText: {
    fontWeight: "700",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  editBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    ...Platform.select({
      web: {
        boxShadow: "0px 1px 2px rgba(0,0,0,0.25)",
      } as any,
      default: {
        elevation: 3,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.25,
        shadowRadius: 2,
      },
    }),
  },
});
