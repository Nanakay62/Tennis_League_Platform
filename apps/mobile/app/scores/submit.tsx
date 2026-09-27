import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { colors } from "../../src/theme/colors";
import {
  submitMatch,
  SubmitMatchPayload,
  SetScoreInput,
} from "../../src/api/client";

type MatchFormat = "best_of_three" | "match_tiebreak" | "pro_set_10" | "fast4";
type OutcomeType = "played" | "retired" | "walkover" | "no_show";

export default function SubmitScoreScreen() {
  const params = useLocalSearchParams<{ divisionId?: string; opponentId?: string }>();

  const [divisionId, setDivisionId] = useState(params.divisionId || "div-comp-1");
  const [opponentId, setOpponentId] = useState(params.opponentId || "");
  const [iAmWinner, setIAmWinner] = useState(true);
  const [format, setFormat] = useState<MatchFormat>("best_of_three");
  const [outcomeType, setOutcomeType] = useState<OutcomeType>("played");

  // Sets state
  const [set1Winner, setSet1Winner] = useState(6);
  const [set1Loser, setSet1Loser] = useState(3);
  const [set2Winner, setSet2Winner] = useState(6);
  const [set2Loser, setSet2Loser] = useState(4);
  const [hasSet3, setHasSet3] = useState(false);
  const [set3Winner, setSet3Winner] = useState(10);
  const [set3Loser, setSet3Loser] = useState(8);

  // No-show wait minutes
  const [minutesWaited, setMinutesWaited] = useState(20);
  const [retirementNotes, setRetirementNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    setErrorMessage(null);

    if (!divisionId.trim()) {
      setErrorMessage("Please enter a Division ID.");
      return;
    }
    if (!opponentId.trim()) {
      setErrorMessage("Please enter your Opponent's Player ID.");
      return;
    }

    const sets: SetScoreInput[] = [];

    if (outcomeType === "played" || outcomeType === "retired") {
      if (format === "pro_set_10") {
        sets.push({ winner: set1Winner, loser: set1Loser });
      } else {
        sets.push({ winner: set1Winner, loser: set1Loser });
        sets.push({ winner: set2Winner, loser: set2Loser });
        if (hasSet3) {
          sets.push({
            winner: set3Winner,
            loser: set3Loser,
            super_tiebreak: format === "match_tiebreak",
          });
        }
      }
    }

    const payload: SubmitMatchPayload = {
      division_id: divisionId.trim(),
      opponent_id: opponentId.trim(),
      i_am_winner: iAmWinner,
      format,
      outcome_type: outcomeType,
      sets,
      minutes_waited: outcomeType === "no_show" ? minutesWaited : undefined,
      retirement_notes: outcomeType === "retired" ? retirementNotes : undefined,
    };

    setLoading(true);
    try {
      const res = await submitMatch(payload);
      const msg =
        res.status === "confirmed"
          ? "Score recorded and confirmed!"
          : "Score submitted! Waiting for opponent confirmation.";

      if (Platform.OS === "web") {
        alert(msg);
        router.back();
      } else {
        Alert.alert("Success", msg, [{ text: "OK", onPress: () => router.back() }]);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit match score");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Report Match Score</Text>
      <Text style={styles.subheading}>
        Enter the verified score line. Your opponent will be notified to confirm.
      </Text>

      {errorMessage && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
        </View>
      )}

      {/* Division & Opponent */}
      <View style={styles.section}>
        <Text style={styles.label}>Division ID</Text>
        <TextInput
          style={styles.input}
          value={divisionId}
          onChangeText={setDivisionId}
          placeholder="e.g. div-comp-1"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Opponent Player ID</Text>
        <TextInput
          style={styles.input}
          value={opponentId}
          onChangeText={setOpponentId}
          placeholder="e.g. player-uuid or profile-id"
          placeholderTextColor="#999"
        />
      </View>

      {/* Match Result Winner Toggle */}
      <View style={styles.section}>
        <Text style={styles.label}>Match Outcome</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, iAmWinner && styles.toggleBtnActive]}
            onPress={() => setIAmWinner(true)}
          >
            <Text style={[styles.toggleBtnText, iAmWinner && styles.toggleBtnTextActive]}>
              🏆 I Won
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, !iAmWinner && styles.toggleBtnActive]}
            onPress={() => setIAmWinner(false)}
          >
            <Text style={[styles.toggleBtnText, !iAmWinner && styles.toggleBtnTextActive]}>
              🤝 Opponent Won
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Match Format */}
      <View style={styles.section}>
        <Text style={styles.label}>Match Format</Text>
        <View style={styles.chipsRow}>
          {(
            [
              { key: "best_of_three", label: "Best of 3 Sets" },
              { key: "match_tiebreak", label: "Match Tiebreak (10-pt)" },
              { key: "pro_set_10", label: "10-Game Pro Set" },
              { key: "fast4", label: "Fast4" },
            ] as const
          ).map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.chip, format === item.key && styles.chipActive]}
              onPress={() => setFormat(item.key)}
            >
              <Text style={[styles.chipText, format === item.key && styles.chipTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Outcome Type */}
      <View style={styles.section}>
        <Text style={styles.label}>Play Status</Text>
        <View style={styles.chipsRow}>
          {(
            [
              { key: "played", label: "Full Match" },
              { key: "retired", label: "Retirement" },
              { key: "no_show", label: "No-Show (Walkover)" },
              { key: "walkover", label: "Mutual Forfeit" },
            ] as const
          ).map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.chip, outcomeType === item.key && styles.chipActive]}
              onPress={() => setOutcomeType(item.key)}
            >
              <Text
                style={[
                  styles.chipText,
                  outcomeType === item.key && styles.chipTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Conditional Inputs: No-Show */}
      {outcomeType === "no_show" && (
        <View style={styles.section}>
          <Text style={styles.label}>Minutes Waited at Court (Handbook Rule: min 20 min)</Text>
          <View style={styles.stepperRow}>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setMinutesWaited(Math.max(0, minutesWaited - 5))}
            >
              <Text style={styles.stepBtnText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.stepValue}>{minutesWaited} min</Text>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setMinutesWaited(minutesWaited + 5)}
            >
              <Text style={styles.stepBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          {minutesWaited < 20 && (
            <Text style={styles.warningText}>
              ⚠️ League rules require waiting at least 20 minutes past scheduled match time before claiming a walkover.
            </Text>
          )}
        </View>
      )}

      {/* Conditional Inputs: Retirement Notes */}
      {outcomeType === "retired" && (
        <View style={styles.section}>
          <Text style={styles.label}>Retirement Reason</Text>
          <TextInput
            style={styles.input}
            value={retirementNotes}
            onChangeText={setRetirementNotes}
            placeholder="e.g. Ankle sprain in 2nd set"
            placeholderTextColor="#999"
          />
        </View>
      )}

      {/* Score Steppers */}
      {(outcomeType === "played" || outcomeType === "retired") && (
        <View style={styles.section}>
          <Text style={styles.label}>Set Scores (Winner - Loser)</Text>

          {/* Set 1 */}
          <View style={styles.setRow}>
            <Text style={styles.setText}>Set 1:</Text>
            <View style={styles.stepperRowSmall}>
              <TouchableOpacity
                style={styles.stepBtnSmall}
                onPress={() => setSet1Winner(Math.max(0, set1Winner - 1))}
              >
                <Text style={styles.stepBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.stepValueSmall}>{set1Winner}</Text>
              <TouchableOpacity
                style={styles.stepBtnSmall}
                onPress={() => setSet1Winner(set1Winner + 1)}
              >
                <Text style={styles.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.setDivider}>-</Text>
            <View style={styles.stepperRowSmall}>
              <TouchableOpacity
                style={styles.stepBtnSmall}
                onPress={() => setSet1Loser(Math.max(0, set1Loser - 1))}
              >
                <Text style={styles.stepBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.stepValueSmall}>{set1Loser}</Text>
              <TouchableOpacity
                style={styles.stepBtnSmall}
                onPress={() => setSet1Loser(set1Loser + 1)}
              >
                <Text style={styles.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Set 2 (if not Pro Set) */}
          {format !== "pro_set_10" && (
            <View style={styles.setRow}>
              <Text style={styles.setText}>Set 2:</Text>
              <View style={styles.stepperRowSmall}>
                <TouchableOpacity
                  style={styles.stepBtnSmall}
                  onPress={() => setSet2Winner(Math.max(0, set2Winner - 1))}
                >
                  <Text style={styles.stepBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.stepValueSmall}>{set2Winner}</Text>
                <TouchableOpacity
                  style={styles.stepBtnSmall}
                  onPress={() => setSet2Winner(set2Winner + 1)}
                >
                  <Text style={styles.stepBtnText}>+</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.setDivider}>-</Text>
              <View style={styles.stepperRowSmall}>
                <TouchableOpacity
                  style={styles.stepBtnSmall}
                  onPress={() => setSet2Loser(Math.max(0, set2Loser - 1))}
                >
                  <Text style={styles.stepBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.stepValueSmall}>{set2Loser}</Text>
                <TouchableOpacity
                  style={styles.stepBtnSmall}
                  onPress={() => setSet2Loser(set2Loser + 1)}
                >
                  <Text style={styles.stepBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Optional Set 3 / Match Tiebreak */}
          {format !== "pro_set_10" && (
            <View style={styles.set3ToggleContainer}>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setHasSet3(!hasSet3)}
              >
                <Text style={styles.checkboxIcon}>{hasSet3 ? "☑️" : "⬜"}</Text>
                <Text style={styles.checkboxLabel}>
                  {format === "match_tiebreak"
                    ? "Match Tiebreak (3rd Set 10-Point TB)"
                    : "Deciding 3rd Set Played"}
                </Text>
              </TouchableOpacity>

              {hasSet3 && (
                <View style={styles.setRow}>
                  <Text style={styles.setText}>
                    {format === "match_tiebreak" ? "TB:" : "Set 3:"}
                  </Text>
                  <View style={styles.stepperRowSmall}>
                    <TouchableOpacity
                      style={styles.stepBtnSmall}
                      onPress={() => setSet3Winner(Math.max(0, set3Winner - 1))}
                    >
                      <Text style={styles.stepBtnText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.stepValueSmall}>{set3Winner}</Text>
                    <TouchableOpacity
                      style={styles.stepBtnSmall}
                      onPress={() => setSet3Winner(set3Winner + 1)}
                    >
                      <Text style={styles.stepBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.setDivider}>-</Text>
                  <View style={styles.stepperRowSmall}>
                    <TouchableOpacity
                      style={styles.stepBtnSmall}
                      onPress={() => setSet3Loser(Math.max(0, set3Loser - 1))}
                    >
                      <Text style={styles.stepBtnText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.stepValueSmall}>{set3Loser}</Text>
                    <TouchableOpacity
                      style={styles.stepBtnSmall}
                      onPress={() => setSet3Loser(set3Loser + 1)}
                    >
                      <Text style={styles.stepBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Submit Score</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  subheading: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: "#ffebee",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "500",
  },
  section: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: "#fff",
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 12,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toggleBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  toggleBtnTextActive: {
    color: "#fff",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.text,
  },
  chipTextActive: {
    color: "#fff",
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginVertical: 6,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.primary,
  },
  stepValue: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  warningText: {
    fontSize: 13,
    color: "#e65100",
    marginTop: 6,
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
    justifyContent: "space-between",
  },
  setText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    width: 60,
  },
  stepperRowSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepBtnSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepValueSmall: {
    fontSize: 17,
    fontWeight: "700",
    width: 24,
    textAlign: "center",
    color: colors.text,
  },
  setDivider: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.textMuted,
    marginHorizontal: 8,
  },
  set3ToggleContainer: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  checkboxIcon: {
    fontSize: 18,
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
