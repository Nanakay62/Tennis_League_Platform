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
