/**
 * Mock Images Catalog
 *
 * NOTE: These mock assets match the Figma reference redesign and can easily
 * be replaced with production photography or remote CDN URLs as they become available.
 */

export const MOCK_IMAGES = {
  heroTennisBall: require("../../assets/images/hero_tennis_ball.jpg"),
  seasonCourtNet: require("../../assets/images/season_court_net.jpg"),
  avatars: {
    max: require("../../assets/images/avatar_max.jpg"),
    lukas: require("../../assets/images/avatar_lukas.jpg"),
    felix: require("../../assets/images/avatar_felix.jpg"),
  },
};

/**
 * Returns a matching mock avatar image based on player name, or a default.
 */
export function getPlayerAvatar(name?: string | null) {
  if (!name) return MOCK_IMAGES.avatars.max;
  const lower = name.toLowerCase();
  if (lower.includes("kwame") || lower.includes("lukas")) return MOCK_IMAGES.avatars.lukas;
  if (lower.includes("kofi") || lower.includes("felix")) return MOCK_IMAGES.avatars.felix;
  if (lower.includes("nana") || lower.includes("max")) return MOCK_IMAGES.avatars.max;
  return MOCK_IMAGES.avatars.max;
}
