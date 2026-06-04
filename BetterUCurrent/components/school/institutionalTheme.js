import { schoolWellnessTheme } from "./schoolWellnessTheme";

/**
 * B2B institutional tokens — leadership console + premium student campus hub.
 * Extends schoolWellnessTheme (which extends spiritualTheme).
 */
export const institutionalTheme = {
  ...schoolWellnessTheme,
  /** Jesuit / prep gold accent for leadership chrome */
  gold: "#d4af37",
  goldDim: "rgba(212, 175, 55, 0.14)",
  goldMuted: "#e8d5a3",
  panel: "rgba(255, 255, 255, 0.06)",
  panelBorder: "rgba(255, 255, 255, 0.1)",
  panelElevated: "rgba(255, 255, 255, 0.08)",
  heroLeadership: ["#050708", "#0c1418", "#081a1f", "#050708"],
  shadowBorder: "rgba(0, 229, 229, 0.18)",
  success: "#5ce1a3",
  successDim: "rgba(92, 225, 163, 0.12)",
  warn: "#ff9aa6",
  warnDim: "rgba(255, 91, 107, 0.12)",
  calm: "#8ab4ff",
  calmDim: "rgba(138, 180, 255, 0.12)",
};

export default institutionalTheme;
