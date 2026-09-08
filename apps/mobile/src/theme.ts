import { Platform } from "react-native";

// GurmeGo mobile'in görsel kimliği — "güneşli hardal" (Yön I): apps/web'in sıcak/editorial
// mizacını (serif başlıklar, koyu alıntı panosu) hardal-sarı bir palet üzerinde, native bir liste
// yapısıyla birleştirir. Kullanıcıyla birlikte karşılaştırmalı mockup'lar üzerinden seçildi
// (bkz. docs/superpowers/specs/ altında ayrı bir tasarım dokümanı yok — bu seçim sohbet üzerinden
// yapıldı, token'lar buraya, tek yere yazıldı).
export const colors = {
  ink: "#2b2010",
  inkSoft: "rgba(43, 32, 16, 0.62)",
  inkFaint: "rgba(43, 32, 16, 0.42)",
  accent: "#d99a1f",
  accentSoft: "#f0c869",
  accentDeep: "#8a5c12",
  paper: "#faf3df",
  paperCard: "#fffcf3",
  line: "rgba(43, 32, 16, 0.12)",
  chipBg: "#f3dfa8",
  chipText: "#6b4a12",
  danger: "#b5482a",
  positive: "#2e8b4f",
} as const;

export const typography = {
  // Sistem serif fallback (Georgia iOS'ta gerçek bir font; Android'de generic "serif" ailesi
  // Noto Serif'e düşer). Google Fonts'tan Lora gibi özel bir yüz eklemek expo-font + asset
  // indirme gerektirir -- ilk görsel geçişte kapsam dışı, sonraki bir incelik turunda eklenebilir.
  serif: Platform.select({ ios: "Georgia", android: "serif", default: "Georgia" }),
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
} as const;
