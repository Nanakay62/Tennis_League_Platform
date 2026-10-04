import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useThemeColors } from "../../src/theme/colors";
import {
  submitMatch,
  checkHandicapEligibility,
  SubmitMatchPayload,
  SetScoreInput,
  HandicapCheckResponse,
} from "../../src/api/client";
import { AppShell, Card, Button, Badge } from "../../src/components";

type MatchFormat = "best_of_three" | "match_tiebreak" | "pro_set_10" | "fast4";
type OutcomeType = "played" | "retired" | "walkover" | "no_show";

export default function SubmitScoreScreen() {
  const { colors } = useThemeColors();
  const params = useLocalSearchParams<{ divisionId?: string; opponentId?: string }>();

  const [divisionId, setDivisionId] = useState(params.divisionId || "div-accra-comp-1");
  const [opponentId, setOpponentId] = useState(params.opponentId || "");
  const [iAmWinner, setIAmWinner] = useState(true);
  const [format, setFormat] = useState<MatchFormat>("best_of_three");
  const [outcomeType, setOutcomeType] = useState<OutcomeType>("played");

  // Handicap state
  const [isHandicap, setIsHandicap] = useState(false);
  const [handicapInfo, setHandicapInfo] = useState<HandicapCheckResponse | null>(null);
  const [checkingHandicap, setCheckingHandicap] = useState(false);
  const [handicapCheckError, setHandicapCheckError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      if (!opponentId.trim()) {
        if (active) {
          setHandicapInfo(null);
          setIsHandicap(false);
          setHandicapCheckError(null);
        }
        return;
      }

      setCheckingHandicap(true);
      setHandicapCheckError(null);
      try {
        const info = await checkHandicapEligibility(opponentId.trim());
        if (active) {
          setHandicapInfo(info);
          if (!info.eligible) {
            setIsHandicap(false);
          }
        }
      } catch (err: any) {
        if (active) {
          setHandicapCheckError(err.message || "Could not verify handicap eligibility");
          setHandicapInfo(null);
          setIsHandicap(false);
        }
      } finally {
        if (active) setCheckingHandicap(false);
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [opponentId]);

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
      is_handicap: isHandicap,
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

  const renderStepper = (
    label: string,
    value: number,
    onChange: (val: number) => void,
    min: number = 0,
    max: number = 20
  ) => (
    <View style={styles.stepperContainer}>
      <Text style={[styles.stepperLabel, { color: colors.textSecondary }]}>{label}</Text>
      <View style={styles.stepperControls}>
        <TouchableOpacity
          style={[styles.stepperBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
          onPress={() => onChange(Math.max(min, value - 1))}
          activeOpacity={0.7}
        >
          <Feather name="minus" size={16} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.stepperValue, { color: colors.textPrimary }]}>{value}</Text>
        <TouchableOpacity
          style={[styles.stepperBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
          onPress={() => onChange(Math.min(max, value + 1))}
          activeOpacity={0.7}
        >
          <Feather name="plus" size={16} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <AppShell title="SUBMIT SCORE" showBack>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Report Match Score</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Enter the verified score line. Your opponent will be notified to confirm.
        </Text>
      </View>

      {errorMessage && (
        <View style={[styles.errorBox, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}>
          <Feather name="alert-triangle" size={16} color={colors.danger} style={{ marginRight: 8 }} />
          <Text style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</Text>
        </View>
      )}

      {/* Match Details Card */}
      <Card title="Match Details">
        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Division ID</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surfaceMuted,
              color: colors.textPrimary,
              borderColor: colors.border,
            },
          ]}
          value={divisionId}
          onChangeText={setDivisionId}
          placeholder="e.g. div-accra-comp-1"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Opponent Player ID</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surfaceMuted,
              color: colors.textPrimary,
              borderColor: colors.border,
            },
          ]}
          value={opponentId}
          onChangeText={setOpponentId}
          placeholder="e.g. player-uuid or p2"
          placeholderTextColor={colors.textMuted}
        />
      </Card>

      {/* Outcome & Format Card */}
      <Card title="Outcome & Format">
        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Winner</Text>
        <View style={styles.btnRow}>
          <Button
            variant={iAmWinner ? "primary" : "secondary"}
            size="md"
            onPress={() => setIAmWinner(true)}
            icon="award"
            style={{ flex: 1 }}
          >
            I Won
          </Button>
          <Button
            variant={!iAmWinner ? "primary" : "secondary"}
            size="md"
            onPress={() => setIAmWinner(false)}
            icon="user"
            style={{ flex: 1 }}
          >
            Opponent Won
          </Button>
        </View>

        <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 14 }]}>Match Format</Text>
        <View style={styles.formatWrap}>
          {[
            { id: "best_of_three", label: "Best of 3 Sets" },
            { id: "match_tiebreak", label: "2 Sets + 10-pt TB" },
            { id: "pro_set_10", label: "10-Game Pro Set" },
            { id: "fast4", label: "Fast4" },
          ].map((fmt) => (
            <Button
              key={fmt.id}
              variant={format === fmt.id ? "primary" : "secondary"}
              size="sm"
              onPress={() => setFormat(fmt.id as MatchFormat)}
              style={styles.chipBtn}
            >
              {fmt.label}
            </Button>
          ))}
        </View>

        <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 14 }]}>Outcome Type</Text>
        <View style={styles.formatWrap}>
          {[
            { id: "played", label: "Played Normally" },
            { id: "retired", label: "Opponent Retired" },
            { id: "no_show", label: "No-Show / Late Cancel" },
          ].map((out) => (
            <Button
              key={out.id}
              variant={outcomeType === out.id ? "primary" : "secondary"}
              size="sm"
              onPress={() => setOutcomeType(out.id as OutcomeType)}
              style={styles.chipBtn}
            >
              {out.label}
            </Button>
          ))}
        </View>
      </Card>

      {/* Handicap Scoring Card */}
      {outcomeType === "played" && (
        <Card title="Handicap Scoring (Optional)">
          <Text style={[styles.hintText, { color: colors.textSecondary, marginBottom: 12 }]}>
            Leveling system for unequal skill ratings (requires verified rating with &ge; 6 confirmed matches and gap &gt; 0.5).
          </Text>

          {!opponentId.trim() ? (
            <View style={[styles.handicapBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <Feather name="info" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
              <Text style={[styles.handicapBoxText, { color: colors.textSecondary }]}>
                Enter an Opponent Player ID above to check Handicap Scoring qualification.
              </Text>
            </View>
          ) : checkingHandicap ? (
            <View style={[styles.handicapBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.handicapBoxText, { color: colors.textSecondary }]}>
                Checking rating gap and platform match verification...
              </Text>
            </View>
          ) : handicapInfo ? (
            handicapInfo.eligible ? (
              <View>
                <View style={styles.handicapToggleRow}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={[styles.handicapToggleTitle, { color: colors.textPrimary }]}>
                      Apply Handicap Scoring
                    </Text>
                    <Text style={[styles.handicapToggleSub, { color: colors.textSecondary }]}>
                      Rating gap {handicapInfo.rating_gap} • {handicapInfo.lead} lead
                    </Text>
                  </View>
                  <Button
                    variant={isHandicap ? "primary" : "secondary"}
                    size="sm"
                    onPress={() => setIsHandicap(!isHandicap)}
                  >
                    {isHandicap ? "Enabled" : "Enable"}
                  </Button>
                </View>

                {isHandicap && (
                  <View
                    style={[
                      styles.handicapDetailBox,
                      { backgroundColor: colors.accentSecondary, borderColor: colors.primary },
                    ]}
                  >
                    <View style={styles.handicapRuleRow}>
                      <Badge variant="accent" size="sm" label={`Head Start: ${handicapInfo.lead}`} />
                      <Badge variant="neutral" size="sm" label={handicapInfo.court || "Ad court"} />
                    </View>
                    <Text style={[styles.handicapDescText, { color: colors.textPrimary, marginTop: 8 }]}>
                      • Head Start: {handicapInfo.lower_rated_player_name || "Lower-rated player"} begins each game leading {handicapInfo.lead}.
                    </Text>
                    <Text style={[styles.handicapDescText, { color: colors.textPrimary }]}>
                      • Serving Court: Server begins each game serving to the {handicapInfo.court || "Ad court"}.
                    </Text>
                    <Text style={[styles.handicapDescText, { color: colors.textPrimary }]}>
                      • Tiebreak Rule: Standard 7-point tiebreak at 6-6 (starts 0-0).
                    </Text>
                    <Text style={[styles.handicapDescText, { color: colors.textSecondary, marginTop: 4, fontStyle: "italic" }]}>
                      • Matches count identically to regular matches in league standings.
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View
                style={[
                  styles.handicapBox,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                ]}
              >
                <Feather name="alert-circle" size={16} color={colors.warning} style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.handicapBoxText, { color: colors.textPrimary, fontWeight: "600" }]}>
                    Not Qualified for Handicap Scoring
                  </Text>
                  <Text style={[styles.handicapBoxText, { color: colors.textSecondary, marginTop: 4 }]}>
                    {handicapInfo.reason}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                    <Badge
                      variant="neutral"
                      size="sm"
                      label={`Your verified matches: ${handicapInfo.my_match_count || 0} / ${handicapInfo.min_qualifying_matches}`}
                    />
                    <Badge
                      variant="neutral"
                      size="sm"
                      label={`Opponent matches: ${handicapInfo.opponent_match_count || 0} / ${handicapInfo.min_qualifying_matches}`}
                    />
                  </View>
                </View>
              </View>
            )
          ) : handicapCheckError ? (
            <View style={[styles.handicapBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <Feather name="info" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
              <Text style={[styles.handicapBoxText, { color: colors.textSecondary }]}>
                {handicapCheckError}
              </Text>
            </View>
          ) : null}
        </Card>
      )}

      {/* Set Scores Card */}
      {(outcomeType === "played" || outcomeType === "retired") && (
        <Card title="Set Scores">
          {/* Set 1 */}
          <View style={styles.setRow}>
            <Text style={[styles.setTitle, { color: colors.textPrimary }]}>Set 1</Text>
            <View style={styles.steppersRow}>
              {renderStepper("Winner Games", set1Winner, setSet1Winner, 0, 15)}
              {renderStepper("Loser Games", set1Loser, setSet1Loser, 0, 15)}
            </View>
          </View>

          {/* Set 2 (if not pro set) */}
          {format !== "pro_set_10" && (
            <View style={[styles.setRow, { borderTopColor: colors.borderSubtle, borderTopWidth: 1 }]}>
              <Text style={[styles.setTitle, { color: colors.textPrimary }]}>Set 2</Text>
              <View style={styles.steppersRow}>
                {renderStepper("Winner Games", set2Winner, setSet2Winner, 0, 15)}
                {renderStepper("Loser Games", set2Loser, setSet2Loser, 0, 15)}
              </View>
            </View>
          )}

          {/* Set 3 Toggle & Steppers */}
          {format !== "pro_set_10" && (
            <View style={[styles.setRow, { borderTopColor: colors.borderSubtle, borderTopWidth: 1 }]}>
              <View style={styles.set3Header}>
                <Text style={[styles.setTitle, { color: colors.textPrimary }]}>
                  {format === "match_tiebreak" ? "10-Point Super Tiebreak" : "Set 3 (Decider)"}
                </Text>
                <Button
                  variant={hasSet3 ? "primary" : "secondary"}
                  size="sm"
                  onPress={() => setHasSet3(!hasSet3)}
                >
                  {hasSet3 ? "Remove" : "+ Add Set 3"}
                </Button>
              </View>

              {hasSet3 && (
                <View style={[styles.steppersRow, { marginTop: 10 }]}>
                  {renderStepper(
                    format === "match_tiebreak" ? "Winner Points" : "Winner Games",
                    set3Winner,
                    setSet3Winner,
                    0,
                    30
                  )}
                  {renderStepper(
                    format === "match_tiebreak" ? "Loser Points" : "Loser Games",
                    set3Loser,
                    setSet3Loser,
                    0,
                    30
                  )}
                </View>
              )}
            </View>
          )}
        </Card>
      )}

      {/* No-show details */}
      {outcomeType === "no_show" && (
        <Card title="No-Show Verification">
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Minutes Waited at Court</Text>
          {renderStepper("Minutes Waited (Rule: min 20m)", minutesWaited, setMinutesWaited, 20, 120)}
          <Text style={[styles.hintText, { color: colors.textSecondary }]}>
            League policy requires waiting at least 20 minutes before filing a no-show report. 0-0 win will be recorded.
          </Text>
        </Card>
      )}

      {/* Retirement details */}
      {outcomeType === "retired" && (
        <Card title="Retirement Details">
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Notes (Injury, Heat, Walkoff)</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.surfaceMuted,
                color: colors.textPrimary,
                borderColor: colors.border,
              },
            ]}
            value={retirementNotes}
            onChangeText={setRetirementNotes}
            placeholder="e.g. Retired in 2nd set due to ankle strain"
            placeholderTextColor={colors.textMuted}
          />
        </Card>
      )}

      {/* Actions */}
      <View style={styles.actionsContainer}>
        <Button
          variant="primary"
          size="lg"
          onPress={handleSubmit}
          loading={loading}
          icon="check-circle"
        >
          Submit Score for Confirmation
        </Button>

        <Button
          variant="secondary"
          size="md"
          onPress={() => router.back()}
          disabled={loading}
          style={{ marginTop: 8 }}
        >
          Cancel
        </Button>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: "500",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    marginBottom: 12,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 6,
  },
  formatWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6,
  },
  chipBtn: {
    marginBottom: 4,
  },
  setRow: {
    paddingVertical: 12,
  },
  setTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  steppersRow: {
    flexDirection: "row",
    gap: 16,
  },
  stepperContainer: {
    flex: 1,
  },
  stepperLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
  },
  stepperControls: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: "700",
    width: 36,
    textAlign: "center",
  },
  set3Header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hintText: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 8,
  },
  actionsContainer: {
    marginTop: 8,
    marginBottom: 32,
  },
  handicapBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  handicapBoxText: {
    fontSize: 12,
    lineHeight: 18,
  },
  handicapToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  handicapToggleTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  handicapToggleSub: {
    fontSize: 12,
    marginTop: 2,
  },
  handicapDetailBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
  },
  handicapRuleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
  },
  handicapDescText: {
    fontSize: 12,
    lineHeight: 18,
  },
});
