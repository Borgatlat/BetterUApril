import { spiritualTheme } from "./spiritual/spiritualTheme";

/** School wellness hub tokens — extends spiritual tab for a unified campus product feel. */
export const schoolWellnessTheme = {
  ...spiritualTheme,
  radiusXl: 16,
  radiusChip: 28,
  heroGradient: ["#f4f6f8", "#ffffff", "#eef2f7"],
  pulseDone: "#22c55e",
  pulseDoneDim: "rgba(34, 197, 94, 0.14)",
  pulsePending: "#f59e0b",
  pulsePendingDim: "rgba(245, 158, 11, 0.14)",
  purple: "#c4a8ff",
  purpleDim: "rgba(139, 92, 246, 0.15)",
  gold: "#d4af37",
  goldDim: "rgba(212, 175, 55, 0.14)",
  goldMuted: "#e8d5a3",
  spacing: { xs: 8, sm: 12, md: 16, lg: 24, xl: 28 },
};

export default schoolWellnessTheme;
