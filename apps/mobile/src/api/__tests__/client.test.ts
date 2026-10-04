import {
  getDivisionRoster,
  getPrograms,
  getDivisionStandings,
  getCourts,
  ApiError,
  USE_MOCKS,
} from "../client";

describe("Mobile API client", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe("Rule 5 Gating: getDivisionRoster", () => {
    it("returns gated: true and empty players list on 401 unauthenticated", async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ detail: "Not authenticated" }),
      } as Response);

      const result = await getDivisionRoster("div-accra-comp-1");
      expect(result).toEqual({ players: [], gated: true });
      expect(result.players).toHaveLength(0);
    });

    it("returns gated: true and empty players list on 403 forbidden", async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ detail: "Active division enrollment required" }),
      } as Response);

      const result = await getDivisionRoster("div-accra-comp-1");
      expect(result).toEqual({ players: [], gated: true });
      expect(result.players).toHaveLength(0);
    });

    it("returns players with gated: false on 200 success", async () => {
      const mockRoster = [
        {
          player_id: "p1",
          display_name: "Kwame Mensah",
          home_area: "Accra",
          rating: "3.5",
          is_daytime: false,
          phone: "+233 24 111 1111",
          email: "kwame@example.com",
        },
      ];
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockRoster,
      } as Response);

      const result = await getDivisionRoster("div-accra-comp-1");
      expect(result).toEqual({ players: mockRoster, gated: false });
    });
  });

  describe("Mock guard: error rethrowing when USE_MOCKS is disabled", () => {
    it("rethrows error on getPrograms failure when USE_MOCKS is false", async () => {
      if (USE_MOCKS) {
        // Skip assertion if run in an environment where USE_MOCKS happens to be enabled
        return;
      }
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ detail: "Server error" }),
      } as Response);

      await expect(getPrograms()).rejects.toThrow(ApiError);
    });

    it("rethrows error on getDivisionStandings failure when USE_MOCKS is false", async () => {
      if (USE_MOCKS) return;
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ detail: "Not found" }),
      } as Response);

      await expect(getDivisionStandings("div-unknown")).rejects.toThrow();
    });

    it("rethrows error on getCourts network failure when USE_MOCKS is false", async () => {
      if (USE_MOCKS) return;
      globalThis.fetch = jest.fn().mockRejectedValue(new Error("Network connection lost"));

      await expect(getCourts()).rejects.toThrow("Network connection lost");
    });
  });
});
