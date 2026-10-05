import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "../constants/api";
export { API_BASE_URL };

export class ApiError extends Error {
  constructor(public status: number, message?: string) {
    super(message || `API error: ${status}`);
    this.name = "ApiError";
  }
}

const isDev = typeof __DEV__ !== "undefined" ? __DEV__ : process.env.NODE_ENV !== "production";
export const USE_MOCKS = Boolean(isDev && process.env.EXPO_PUBLIC_USE_MOCKS === "1");

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
  genderConstraint?: string;
  minAge?: number | null;
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
    if (!res.ok) throw new ApiError(res.status, `HTTP error: ${res.status}`);
    return await res.json();
  } catch (err) {
    if (!USE_MOCKS) throw err;
    // Return sample data when API is offline
    return [
      {
        id: "prog-accra-fall-2026",
        name: "Accra Fall Season 2026",
        type: "FLEX_SEASON",
        startDate: "2026-10-01",
        endDate: "2026-11-20",
        status: "Open for Enrollment",
        priceCents: 35000,
        currency: "GHS",
      },
    ];
  }
}

export async function getProgramDivisions(programId: string): Promise<Division[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/programs/${programId}/divisions`);
    if (!res.ok) throw new ApiError(res.status, `HTTP error: ${res.status}`);
    return await res.json();
  } catch (err) {
    if (!USE_MOCKS) throw err;
    return [
      {
        id: "div-accra-comp-1",
        programId,
        name: "Competitive (3.5)",
        ratingBand: "3.5",
        playersCount: 6,
      },
      {
        id: "div-accra-skilled-1",
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
    if (!res.ok) throw new ApiError(res.status, `HTTP error: ${res.status}`);
    return await res.json();
  } catch (err) {
    if (!USE_MOCKS) throw err;
    // Reference seed standings matching Phase 2 vertical slice
    return [
      {
        rank: 1,
        playerId: "p1",
        playerName: "Kwame Mensah",
        homeArea: "Accra",
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
        playerName: "Kofi Boateng",
        homeArea: "Accra",
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
        playerName: "Nana Osei",
        homeArea: "Accra",
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
        playerName: "Yaw Appiah",
        homeArea: "Accra",
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
  is_handicap?: boolean;
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
  is_handicap?: boolean;
  handicap_lead?: string | null;
  handicap_recipient_id?: string | null;
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
  is_handicap?: boolean;
  handicap_lead?: string | null;
}

export interface RosterPlayerResponse {
  player_id: string;
  display_name: string;
  home_area: string | null;
  rating: string | null;
  is_daytime: boolean;
  phone: string | null;
  email: string | null;
  gender?: string;
  birth_year?: number | null;
  favorite_link?: string | null;
  game_description?: string | null;
  about_me?: string | null;
}

export interface HandicapCheckResponse {
  eligible: boolean;
  reason?: string | null;
  lead?: string | null;
  court?: string | null;
  lower_rated_player_id?: string | null;
  lower_rated_player_name?: string | null;
  rating_gap?: number;
  my_match_count?: number;
  opponent_match_count?: number;
  min_qualifying_matches: number;
}

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

export async function checkHandicapEligibility(
  opponentId: string
): Promise<HandicapCheckResponse> {
  const headers = await getAuthHeader();
  const res = await fetch(
    `${API_BASE_URL}/matches/handicap-check?opponent_id=${encodeURIComponent(opponentId)}`,
    { headers }
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to check handicap eligibility");
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
    if (!res.ok) throw new ApiError(res.status, `HTTP error: ${res.status}`);
    return await res.json();
  } catch (err) {
    if (!USE_MOCKS) throw err;
    // Fallback sample feed
    return [
      {
        id: "m-sample-1",
        division_id: "div-accra-comp-1",
        division_name: "Competitive (3.5)",
        winner_name: "Kwame Mensah",
        loser_name: "Kofi Boateng",
        format: "best_of_three",
        outcome_type: "played",
        score_line: "6-3; 6-4",
        played_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      },
      {
        id: "m-sample-2",
        division_id: "div-accra-comp-1",
        division_name: "Competitive (3.5)",
        winner_name: "Nana Osei",
        loser_name: "Yaw Appiah",
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

    if (res.status === 401 || res.status === 403) {
      return { players: [], gated: true };
    }

    if (!res.ok) {
      throw new ApiError(res.status, `HTTP error: ${res.status}`);
    }

    const players = await res.json();
    return { players, gated: false };
  } catch (err: any) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      return { players: [], gated: true };
    }
    if (err?.message?.includes("403") || err?.message?.includes("401")) {
      return { players: [], gated: true };
    }
    if (!USE_MOCKS) throw err;
    // Fallback sample players
    return {
      players: [
        {
          player_id: "p1",
          display_name: "Kwame Mensah",
          home_area: "Accra",
          rating: "3.5",
          is_daytime: true,
          phone: "+233 24 111 1111",
          email: "kwame@example.com",
        },
        {
          player_id: "p2",
          display_name: "Kofi Boateng",
          home_area: "Accra",
          rating: "3.5",
          is_daytime: false,
          phone: "+233 24 222 2222",
          email: "kofi@example.com",
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
    if (!res.ok) throw new ApiError(res.status, `HTTP error: ${res.status}`);
    return await res.json();
  } catch (err) {
    if (!USE_MOCKS) throw err;
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
              player1: { id: "p1", display_name: "Kwame Mensah", seed_number: 1 },
              player2: { id: "p4", display_name: "Yaw Appiah", seed_number: 4 },
              winner: { id: "p1", display_name: "Kwame Mensah" },
              score_summary: "6-3, 6-4",
              is_bye: false,
              deadline: new Date(Date.now() + 86400000 * 3).toISOString(),
              next_match_id: "m-final",
            },
            {
              id: "m-sf2",
              round_number: 1,
              match_number: 2,
              player1: { id: "p2", display_name: "Kofi Boateng", seed_number: 2 },
              player2: { id: "p3", display_name: "Nana Osei", seed_number: 3 },
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
              player1: { id: "p1", display_name: "Kwame Mensah" },
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

export interface Court {
  id: string;
  name: string;
  slug: string;
  address: string;
  postal_code: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  num_courts: number;
  surface: string;
  has_lights: boolean;
  is_indoor: boolean;
  has_hitting_wall: boolean;
  booking_url: string | null;
  average_rating: number;
  review_count: number;
}

export interface CourtReview {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface CourtDetail extends Court {
  reviews: CourtReview[];
}

export interface PartnerMatch {
  player_id: string;
  display_name: string;
  rating: string | null;
  home_area: string | null;
  is_daytime: boolean;
  phone: string | null;
  email: string | null;
}

export interface POTYItem {
  rank: number;
  player_id: string;
  display_name: string;
  total_points: number;
  matches_played: number;
  matches_won: number;
  distinct_opponents: number;
  home_area: string | null;
}

export interface ReferralInfo {
  referral_code: string;
  referral_link: string;
  reward_credit_cents: number;
  completed_referrals_count: number;
  pending_referrals_count: number;
}

export async function getCourts(filters?: {
  surface?: string;
  has_lights?: boolean;
  is_indoor?: boolean;
  has_hitting_wall?: boolean;
}): Promise<Court[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.surface) params.append("surface", filters.surface);
    if (filters?.has_lights !== undefined) params.append("has_lights", String(filters.has_lights));
    if (filters?.is_indoor !== undefined) params.append("is_indoor", String(filters.is_indoor));
    if (filters?.has_hitting_wall !== undefined)
      params.append("has_hitting_wall", String(filters.has_hitting_wall));

    const qs = params.toString();
    const url = qs ? `${API_BASE_URL}/courts?${qs}` : `${API_BASE_URL}/courts`;
    const res = await fetch(url);
    if (!res.ok) throw new ApiError(res.status, `HTTP error: ${res.status}`);
    return await res.json();
  } catch (err) {
    if (!USE_MOCKS) throw err;
    // Fallback sample courts
    return [
      {
        id: "c-1",
        name: "Accra Lawn Tennis Club",
        slug: "accra-lawn-tennis-club",
        address: "Liberation Road, Ridge",
        postal_code: "GA-030-1024",
        city: "Accra",
        latitude: 5.5600,
        longitude: -0.1900,
        num_courts: 6,
        surface: "clay",
        has_lights: true,
        is_indoor: false,
        has_hitting_wall: true,
        booking_url: "https://accralawntennis.com",
        average_rating: 4.8,
        review_count: 14,
      },
      {
        id: "c-2",
        name: "Ghana Tennis Club Adabraka",
        slug: "ghana-tennis-club-adabraka",
        address: "Barnes Road, Adabraka",
        postal_code: "GA-076-4321",
        city: "Accra",
        latitude: 5.5532,
        longitude: -0.2051,
        num_courts: 4,
        surface: "hard",
        has_lights: true,
        is_indoor: false,
        has_hitting_wall: false,
        booking_url: "https://ghanatennisclub.org",
        average_rating: 4.5,
        review_count: 8,
      },
      {
        id: "c-3",
        name: "Tema Country Club",
        slug: "tema-country-club",
        address: "Community 6, Central Park",
        postal_code: "TT-045-8899",
        city: "Tema",
        latitude: 5.6820,
        longitude: -0.0120,
        num_courts: 4,
        surface: "hard",
        has_lights: true,
        is_indoor: false,
        has_hitting_wall: true,
        booking_url: "https://temacountryclub.com",
        average_rating: 4.7,
        review_count: 22,
      },
    ];
  }
}

export async function getCourtDetail(courtId: string): Promise<CourtDetail> {
  const res = await fetch(`${API_BASE_URL}/courts/${courtId}`);
  if (!res.ok) throw new ApiError(res.status, "Court not found");
  return await res.json();
}

export async function postCourtReview(
  courtId: string,
  rating: number,
  comment?: string
): Promise<CourtReview> {
  const headers = await getAuthHeader();
  const res = await fetch(`${API_BASE_URL}/courts/${courtId}/reviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ rating, comment }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to submit review");
  return data;
}

export async function getCompatiblePartners(): Promise<PartnerMatch[]> {
  const headers = await getAuthHeader();
  try {
    const res = await fetch(`${API_BASE_URL}/partners`, { headers });
    if (!res.ok) throw new ApiError(res.status, `HTTP error: ${res.status}`);
    return await res.json();
  } catch (err) {
    if (!USE_MOCKS) throw err;
    // Fallback sample partners
    return [
      {
        player_id: "p1",
        display_name: "Kwame Mensah",
        rating: "3.5",
        home_area: "Accra",
        is_daytime: true,
        phone: "+233 24 111 1111",
        email: "kwame@example.com",
      },
      {
        player_id: "p2",
        display_name: "Kofi Boateng",
        rating: "3.5",
        home_area: "Accra",
        is_daytime: false,
        phone: "+233 24 222 2222",
        email: "kofi@example.com",
      },
      {
        player_id: "p3",
        display_name: "Nana Osei",
        rating: "3.0",
        home_area: "Accra",
        is_daytime: true,
        phone: "+233 24 333 3333",
        email: "nana@example.com",
      },
    ];
  }
}

export async function getPOTYLeaderboard(): Promise<POTYItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/community/poty`);
    if (!res.ok) throw new ApiError(res.status, `HTTP error: ${res.status}`);
    return await res.json();
  } catch (err) {
    if (!USE_MOCKS) throw err;
    return [
      {
        rank: 1,
        player_id: "p1",
        display_name: "Kwame Mensah",
        total_points: 185,
        matches_played: 12,
        matches_won: 9,
        distinct_opponents: 8,
        home_area: "Accra",
      },
      {
        rank: 2,
        player_id: "p2",
        display_name: "Kofi Boateng",
        total_points: 160,
        matches_played: 11,
        matches_won: 7,
        distinct_opponents: 7,
        home_area: "Accra",
      },
      {
        rank: 3,
        player_id: "p3",
        display_name: "Nana Osei",
        total_points: 135,
        matches_played: 10,
        matches_won: 5,
        distinct_opponents: 6,
        home_area: "Accra",
      },
    ];
  }
}

export async function getReferralInfo(): Promise<ReferralInfo> {
  const headers = await getAuthHeader();
  try {
    const res = await fetch(`${API_BASE_URL}/community/referral`, { headers });
    if (!res.ok) throw new ApiError(res.status, `HTTP error: ${res.status}`);
    return await res.json();
  } catch (err) {
    if (!USE_MOCKS) throw err;
    return {
      referral_code: "TENNIS-KWAME-9B41",
      referral_link: "https://accra-tennis.com/join?ref=TENNIS-KWAME-9B41",
      reward_credit_cents: 500,
      completed_referrals_count: 2,
      pending_referrals_count: 1,
    };
  }
}

export interface DeviceResponse {
  id: string;
  push_token: string;
  platform: string;
  is_active: boolean;
  created_at: string;
}

export interface NotificationHistoryItem {
  id: string;
  channel: string;
  event_type: string;
  title: string;
  body: string;
  status: string;
  created_at: string;
}

export async function registerPushDevice(
  pushToken: string,
  platform: string = "ios"
): Promise<DeviceResponse> {
  const headers = await getAuthHeader();
  const res = await fetch(`${API_BASE_URL}/devices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ push_token: pushToken, platform }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to register push device");
  return data;
}

export async function unregisterPushDevice(pushToken: string): Promise<void> {
  const headers = await getAuthHeader();
  const res = await fetch(`${API_BASE_URL}/devices/${encodeURIComponent(pushToken)}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok && res.status !== 404) {
    throw new Error("Failed to unregister push device");
  }
}

export async function getUserDevices(): Promise<DeviceResponse[]> {
  const headers = await getAuthHeader();
  try {
    const res = await fetch(`${API_BASE_URL}/devices`, { headers });
    if (!res.ok) throw new ApiError(res.status, `HTTP error: ${res.status}`);
    return await res.json();
  } catch (err) {
    if (!USE_MOCKS) throw err;
    return [];
  }
}

export async function getNotificationHistory(): Promise<NotificationHistoryItem[]> {
  const headers = await getAuthHeader();
  try {
    const res = await fetch(`${API_BASE_URL}/notifications/history`, { headers });
    if (!res.ok) throw new ApiError(res.status, `HTTP error: ${res.status}`);
    return await res.json();
  } catch (err) {
    if (!USE_MOCKS) throw err;
    return [
      {
        id: "notif-sample-1",
        channel: "push",
        event_type: "kickoff",
        title: "🎾 Kickoff: 3.5 Fall Division",
        body: "Hi Kwame! Your division is live with 6 players. Open the app to view your roster.",
        status: "sent",
        created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
      },
    ];
  }
}

export interface PlayerProfileUpdatePayload {
  display_name?: string;
  phone?: string;
  home_area?: string;
  is_daytime?: boolean;
  avatar_url?: string;
  gender?: string;
  birth_year?: number | null;
  favorite_link?: string | null;
  game_description?: string | null;
  about_me?: string | null;
}

export async function updatePlayerProfile(
  payload: PlayerProfileUpdatePayload
): Promise<any> {
  const headers = await getAuthHeader();
  const res = await fetch(`${API_BASE_URL}/me/profile`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to update profile");
  }
  return data;
}



