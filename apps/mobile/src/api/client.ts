import Constants from "expo-constants";

export const API_BASE_URL =
  Constants.expoConfig?.extra?.apiUrl ||
  process.env.EXPO_PUBLIC_API_URL ||
  "http://localhost:8000";

export interface Program {
  id: string;
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  status: string;
  priceCents: number;
  currency: string;
}

export interface Division {
  id: string;
  programId: string;
  name: string;
  ratingBand: string;
  playersCount: number;
}

export interface StandingRow {
  rank: number;
  playerId: string;
  playerName: string;
  homeArea: string;
  isDaytime: boolean;
  wins: number;
  losses: number;
  gamesWon: number;
  gamesLost: number;
  gamesPct: number;
  gamesPctDisplay: string;
  playoffIndicator: string;
  isPlayoffEligible: boolean;
}

export async function getPrograms(): Promise<Program[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/programs`);
    if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
    return await res.json();
  } catch (err) {
    // Return sample data when API is offline
    return [
      {
        id: "prog-frankfurt-fall-2026",
        name: "Frankfurt Fall Season 2026",
        type: "FLEX_SEASON",
        startDate: "2026-10-01",
        endDate: "2026-11-20",
        status: "Open for Enrollment",
        priceCents: 3495,
        currency: "EUR",
      },
    ];
  }
}

export async function getProgramDivisions(programId: string): Promise<Division[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/programs/${programId}/divisions`);
    if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
    return await res.json();
  } catch (err) {
    return [
      {
        id: "div-comp-1",
        programId,
        name: "Competitive (3.5)",
        ratingBand: "3.5",
        playersCount: 6,
      },
      {
        id: "div-skilled-1",
        programId,
        name: "Skilled (3.0)",
        ratingBand: "3.0",
        playersCount: 6,
      },
    ];
  }
}

export async function getDivisionStandings(divisionId: string): Promise<StandingRow[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/divisions/${divisionId}/standings`);
    if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
    return await res.json();
  } catch (err) {
    // Reference seed standings matching Phase 2 vertical slice
    return [
      {
        rank: 1,
        playerId: "p1",
        playerName: "Lukas Schmidt",
        homeArea: "Sachsenhausen",
        isDaytime: true,
        wins: 5,
        losses: 1,
        gamesWon: 36,
        gamesLost: 15,
        gamesPct: 0.706,
        gamesPctDisplay: "0.706 (36-15)",
        playoffIndicator: "+4",
        isPlayoffEligible: true,
      },
      {
        rank: 2,
        playerId: "p2",
        playerName: "Maximilian Weber",
        homeArea: "Westend",
        isDaytime: false,
        wins: 4,
        losses: 2,
        gamesWon: 30,
        gamesLost: 22,
        gamesPct: 0.577,
        gamesPctDisplay: "0.577 (30-22)",
        playoffIndicator: "+2",
        isPlayoffEligible: false,
      },
      {
        rank: 3,
        playerId: "p3",
        playerName: "Felix Fischer",
        homeArea: "Nordend",
        isDaytime: true,
        wins: 3,
        losses: 3,
        gamesWon: 25,
        gamesLost: 25,
        gamesPct: 0.500,
        gamesPctDisplay: "0.500 (25-25)",
        playoffIndicator: "0",
        isPlayoffEligible: false,
      },
      {
        rank: 4,
        playerId: "p4",
        playerName: "Stefan Meyer",
        homeArea: "Bornheim",
        isDaytime: false,
        wins: 2,
        losses: 4,
        gamesWon: 18,
        gamesLost: 31,
        gamesPct: 0.367,
        gamesPctDisplay: "0.367 (18-31)",
        playoffIndicator: "-2",
        isPlayoffEligible: false,
      },
    ];
  }
}

export interface SetScoreInput {
  winner: number;
  loser: number;
  super_tiebreak?: boolean;
}

export interface SubmitMatchPayload {
  division_id: string;
  opponent_id: string;
  i_am_winner: boolean;
  format: "best_of_three" | "match_tiebreak" | "pro_set_10" | "fast4";
  outcome_type: "played" | "retired" | "walkover" | "no_show";
  sets: SetScoreInput[];
  minutes_waited?: number;
  retirement_notes?: string;
}

export interface MatchResponse {
  id: string;
  division_id: string;
  winner_id: string;
  loser_id: string;
  winner_name: string;
  loser_name: string;
  format: string;
  outcome_type: string;
  sets_summary: string;
  status: string;
  played_at: string;
}

export interface LatestScoreFeedItem {
  id: string;
  division_id: string;
  division_name: string;
  winner_name: string;
  loser_name: string;
  format: string;
  outcome_type: string;
  score_line: string;
  played_at: string;
}

export interface RosterPlayerResponse {
  player_id: string;
  display_name: string;
  home_area: string | null;
  rating: string | null;
  is_daytime: boolean;
  phone: string | null;
  email: string | null;
}

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    let token: string | null = null;
    if (Platform.OS === "web") {
      token = localStorage.getItem("tennis_access_token");
    } else {
      token = await SecureStore.getItemAsync("tennis_access_token");
    }
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export async function submitMatch(payload: SubmitMatchPayload): Promise<MatchResponse> {
  const headers = await getAuthHeader();
  const res = await fetch(`${API_BASE_URL}/matches`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to submit match score");
  }
  return data;
}

export async function confirmMatch(matchId: string): Promise<{ status: string; match_status: string }> {
  const headers = await getAuthHeader();
  const res = await fetch(`${API_BASE_URL}/matches/${matchId}/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to confirm match");
  }
  return data;
}

export async function disputeMatch(
  matchId: string,
  reason: string
): Promise<{ status: string; dispute_id: string; cooling_off_until: string }> {
  const headers = await getAuthHeader();
  const res = await fetch(`${API_BASE_URL}/matches/${matchId}/dispute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ reason }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to dispute match");
  }
  return data;
}

export async function getLatestScoresFeed(): Promise<LatestScoreFeedItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/scores/latest`);
    if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
    return await res.json();
  } catch (err) {
    // Fallback sample feed
    return [
      {
        id: "m-sample-1",
        division_id: "div-comp-1",
        division_name: "Competitive (3.5)",
        winner_name: "Lukas Schmidt",
        loser_name: "Maximilian Weber",
        format: "best_of_three",
        outcome_type: "played",
        score_line: "6-3; 6-4",
        played_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      },
      {
        id: "m-sample-2",
        division_id: "div-comp-1",
        division_name: "Competitive (3.5)",
        winner_name: "Felix Fischer",
        loser_name: "Stefan Meyer",
        format: "match_tiebreak",
        outcome_type: "played",
        score_line: "6-4; 3-6; TB 10-7",
        played_at: new Date(Date.now() - 3600000 * 20).toISOString(),
      },
    ];
  }
}

export async function getDivisionRoster(divisionId: string): Promise<{ players: RosterPlayerResponse[]; gated: boolean }> {
  const headers = await getAuthHeader();
  try {
    const res = await fetch(`${API_BASE_URL}/divisions/${divisionId}/roster`, {
      headers,
    });

    if (res.status === 403) {
      return { players: [], gated: true };
    }

    if (!res.ok) {
      throw new Error(`HTTP error: ${res.status}`);
    }

    const players = await res.json();
    return { players, gated: false };
  } catch (err: any) {
    if (err?.message?.includes("403")) {
      return { players: [], gated: true };
    }
    // Fallback sample players
    return {
      players: [
        {
          player_id: "p1",
          display_name: "Lukas Schmidt",
          home_area: "Sachsenhausen",
          rating: "3.5",
          is_daytime: true,
          phone: "+49 69 111111",
          email: "lukas@example.com",
        },
        {
          player_id: "p2",
          display_name: "Maximilian Weber",
          home_area: "Westend",
          rating: "3.5",
          is_daytime: false,
          phone: "+49 69 222222",
          email: "max@example.com",
        },
      ],
      gated: false,
    };
  }
}

export interface PlayoffPlayerSummary {
  id: string;
  display_name: string;
  seed_number?: number;
}

export interface PlayoffMatch {
  id: string;
  round_number: number;
  match_number: number;
  player1: PlayoffPlayerSummary | null;
  player2: PlayoffPlayerSummary | null;
  winner: PlayoffPlayerSummary | null;
  score_summary: string | null;
  is_bye: boolean;
  deadline: string | null;
  next_match_id: string | null;
}

export interface PlayoffBracket {
  id: string;
  division_id: string;
  bracket_type: string;
  bracket_size: number;
  total_rounds: number;
  status: string;
  rounds: Record<string, PlayoffMatch[]>;
}

export async function getDivisionPlayoffs(divisionId: string): Promise<PlayoffBracket[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/divisions/${divisionId}/playoffs`);
    if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
    return await res.json();
  } catch (err) {
    // Fallback sample playoff bracket
    return [
      {
        id: "pb-sample-1",
        division_id: divisionId,
        bracket_type: "championship",
        bracket_size: 4,
        total_rounds: 2,
        status: "active",
        rounds: {
          "1": [
            {
              id: "m-sf1",
              round_number: 1,
              match_number: 1,
              player1: { id: "p1", display_name: "Lukas Schmidt", seed_number: 1 },
              player2: { id: "p4", display_name: "Stefan Meyer", seed_number: 4 },
              winner: { id: "p1", display_name: "Lukas Schmidt" },
              score_summary: "6-3, 6-4",
              is_bye: false,
              deadline: new Date(Date.now() + 86400000 * 3).toISOString(),
              next_match_id: "m-final",
            },
            {
              id: "m-sf2",
              round_number: 1,
              match_number: 2,
              player1: { id: "p2", display_name: "Maximilian Weber", seed_number: 2 },
              player2: { id: "p3", display_name: "Felix Fischer", seed_number: 3 },
              winner: null,
              score_summary: null,
              is_bye: false,
              deadline: new Date(Date.now() + 86400000 * 3).toISOString(),
              next_match_id: "m-final",
            },
          ],
          "2": [
            {
              id: "m-final",
              round_number: 2,
              match_number: 1,
              player1: { id: "p1", display_name: "Lukas Schmidt" },
              player2: null,
              winner: null,
              score_summary: null,
              is_bye: false,
              deadline: new Date(Date.now() + 86400000 * 10).toISOString(),
              next_match_id: null,
            },
          ],
        },
      },
    ];
  }
}

export async function generateDivisionPlayoffs(
  divisionId: string,
  minWins: number = 5
): Promise<PlayoffBracket> {
  const headers = await getAuthHeader();
  const res = await fetch(`${API_BASE_URL}/divisions/${divisionId}/playoffs/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ min_wins: minWins, enable_veteran_seeding: true }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to generate playoff draw");
  }
  return data;
}

export async function reportPlayoffScore(
  matchId: string,
  winnerId: string,
  scoreSummary: string
): Promise<PlayoffMatch> {
  const headers = await getAuthHeader();
  const res = await fetch(`${API_BASE_URL}/playoffs/matches/${matchId}/score`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ winner_id: winnerId, score_summary: scoreSummary }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to record playoff score");
  }
  return data;
}


