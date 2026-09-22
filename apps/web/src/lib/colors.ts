// Every tone the "sıcak, editöryel" web brand actually uses -- named once, matched exactly, so
// `bg-[#f4f0e7]`-style raw hex classNames become `bg-surface` without changing a single pixel.
// Full list confirmed against `grep -rohE "#[0-9a-fA-F]{3,8}" apps/web/src` (2026-09-22); an
// incomplete list here was the idea-red-team's finding against this work's first draft.
export const PRIMITIVE_COLORS = {
  ink: "#201d18",
  inkSoft: "#2d2923",
  terracotta: "#d75d3b",
  terracottaDark: "#bd4c30",
  terracottaDeep: "#9e422b",
  terracottaLight: "#e77959",
  terracottaSoft: "#e67b5e",
  cream: "#f4f0e7",
  creamLight: "#faf7f0",
  creamPale: "#fffdf8",
  sand: "#eadfce",
  sandLight: "#e8e1d5",
  sandPale: "#eee5d7",
  brown: "#75402f",
} as const;

// Deliberately minimal -- the idea-red-team correctly flagged that the SAME hex plays different
// roles in different places (border, icon, focus ring), so collapsing all of them into one
// `brand` token risks an unintended coupled regression. Only names that carry a real, singular
// decision get a semantic name; everything else stays referenced by its primitive name.
export const SEMANTIC_COLORS = {
  ink: PRIMITIVE_COLORS.ink,
  surface: PRIMITIVE_COLORS.cream,
  // Decorative-only use (borders, icons, focus rings) -- never sits under white/light text.
  brand: PRIMITIVE_COLORS.terracotta,
  // Any solid fill that carries white/light text MUST use this, not `brand`: `terracotta` under
  // white text is 3.81:1 (fails WCAG AA's 4.5:1 for normal text); `terracottaDark` is 4.95:1.
  brandSolid: PRIMITIVE_COLORS.terracottaDark,
} as const;
