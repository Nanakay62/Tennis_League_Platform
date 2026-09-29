import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Avatar, getInitials, SIZE_MAP, FONT_SIZE_MAP } from "../Avatar";

describe("Avatar Component & Initials Fallback", () => {
  describe("getInitials", () => {
    it("returns 'P' when name is null or undefined", () => {
      expect(getInitials(null)).toBe("P");
      expect(getInitials(undefined)).toBe("P");
    });

    it("returns 'P' when name is empty or only whitespace", () => {
      expect(getInitials("")).toBe("P");
      expect(getInitials("   ")).toBe("P");
    });

    it("extracts a single uppercase initial for single-word names", () => {
      expect(getInitials("Nanak")).toBe("N");
      expect(getInitials("alcaraz")).toBe("A");
      expect(getInitials("Djokovic")).toBe("D");
    });

    it("extracts first and last initials for two-word names", () => {
      expect(getInitials("Rafael Nadal")).toBe("RN");
      expect(getInitials("Roger Federer")).toBe("RF");
      expect(getInitials("novak djokovic")).toBe("ND");
    });

    it("extracts first and last initials for multi-word names", () => {
      expect(getInitials("Carlos Alcaraz Garfia")).toBe("CG");
      expect(getInitials("Alexander Zverev Jr.")).toBe("AJ");
    });

    it("handles irregular whitespace and trims properly", () => {
      expect(getInitials("  Steffi   Graf  ")).toBe("SG");
      expect(getInitials("  Serena   ")).toBe("S");
    });
  });

  describe("SIZE_MAP and FONT_SIZE_MAP contracts", () => {
    it("provides consistent scale dimensions for all avatar sizes", () => {
      expect(SIZE_MAP.xs).toBe(24);
      expect(SIZE_MAP.sm).toBe(34);
      expect(SIZE_MAP.md).toBe(40);
      expect(SIZE_MAP.lg).toBe(64);
      expect(SIZE_MAP.xl).toBe(80);

      expect(FONT_SIZE_MAP.xs).toBeLessThan(FONT_SIZE_MAP.sm);
      expect(FONT_SIZE_MAP.sm).toBeLessThan(FONT_SIZE_MAP.md);
      expect(FONT_SIZE_MAP.md).toBeLessThan(FONT_SIZE_MAP.lg);
      expect(FONT_SIZE_MAP.lg).toBeLessThan(FONT_SIZE_MAP.xl);
    });
  });

  describe("Avatar Component Rendering", () => {
    it("renders initials fallback when no avatarUrl is provided", () => {
      const html = renderToStaticMarkup(<Avatar name="Nanak" />);
      expect(html).toContain("N");
      expect(html).not.toContain('role="img"');
    });

    it("renders two initials when two names are provided", () => {
      const html = renderToStaticMarkup(<Avatar name="Rafael Nadal" />);
      expect(html).toContain("RN");
    });

    it("renders image element with accessibility role and label when avatarUrl is provided", () => {
      const avatarUrl = "https://cdn.example.com/avatars/user-1/photo.jpg";
      const html = renderToStaticMarkup(
        <Avatar name="Carlos Alcaraz" avatarUrl={avatarUrl} />
      );
      expect(html).toContain('role="img"');
      expect(html).toContain("Carlos Alcaraz");
      // Does not render initials text when image is present
      expect(html).not.toContain("CA");
    });

    it("renders edit badge when showEditBadge is true", () => {
      const html = renderToStaticMarkup(
        <Avatar name="Novak Djokovic" showEditBadge={true} />
      );
      expect(html).toContain('data-name="camera"');
    });
  });
});
