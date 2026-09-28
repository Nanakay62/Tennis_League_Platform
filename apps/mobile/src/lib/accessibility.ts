/**
 * Accessibility helpers for screen readers, voice announcements, and touch target standards.
 * Adheres to WCAG 2.1 AA and Apple / Android Human Interface Guidelines.
 */

import { AccessibilityRole, StyleProp, ViewStyle } from "react-native";
import { MIN_TOUCH_TARGET } from "../theme/tokens";

/**
 * Converts a raw tennis score summary (e.g. "6-4; 7-6; TB 10-8") into
 * clear, natural spoken text for VoiceOver and TalkBack screen readers.
 */
export function formatScoreForScreenReader(rawScore: string): string {
  if (!rawScore || typeof rawScore !== "string") {
    return "Score not available";
  }

  const trimmed = rawScore.trim();
  if (trimmed.toLowerCase().includes("retired")) {
    return `Match retired: ${trimmed}`;
  }
  if (trimmed.toLowerCase().includes("no-show") || trimmed.toLowerCase().includes("no_show")) {
    return "Match won by opponent no-show";
  }

  // Split multiple sets separated by ';' or ','
  const sets = trimmed.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
  const spokenParts: string[] = [];

  for (const set of sets) {
    if (set.toUpperCase().startsWith("TB")) {
      // e.g. "TB 10-8" or "TB 10-7"
      const scorePart = set.replace(/^TB\s*/i, "").trim();
      const [w, l] = scorePart.split("-").map((n) => n.trim());
      spokenParts.push(`Match tiebreak ${w} points to ${l}`);
    } else if (set.includes("-")) {
      const [w, l] = set.split("-").map((n) => n.trim());
      spokenParts.push(`${w} games to ${l}`);
    } else {
      spokenParts.push(set);
    }
  }

  return spokenParts.join(", ");
}

/**
 * Standard accessible button props adhering to WCAG 2.1 AA.
 */
export function accessibleButtonProps(
  label: string,
  hint?: string,
  role: AccessibilityRole = "button"
) {
  return {
    accessible: true,
    accessibilityRole: role,
    accessibilityLabel: label,
    accessibilityHint: hint,
  };
}

/**
 * Reusable minimum touch target style ensuring touch targets are at least 44x44pt.
 */
export const touchTargetStyle: ViewStyle = {
  minWidth: MIN_TOUCH_TARGET,
  minHeight: MIN_TOUCH_TARGET,
  justifyContent: "center",
  alignItems: "center",
};
