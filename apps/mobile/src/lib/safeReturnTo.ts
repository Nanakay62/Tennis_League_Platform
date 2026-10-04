/**
 * Sanitize and validate internal redirect destinations.
 * Protects against open redirects, protocol-relative URLs, Windows path separators,
 * and URI scheme exploits.
 */
export function safeReturnTo(raw: unknown, fallback = "/account"): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return fallback;
  }
  if (/^\/[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) {
    return fallback;
  }
  return raw;
}
