import { campusThemeDark, campusThemeLight } from "../campusThemeTokens";

/** Shared Spiritual + school hub visuals — light campus default (Tier 2). */
export const spiritualTheme = { ...campusThemeLight };

/** Pre-Tier-2 dark palette — staff mobile console, etc. */
export const spiritualThemeDark = { ...campusThemeDark };

export function getSpiritualTheme(mode = "light") {
  return mode === "dark" ? spiritualThemeDark : spiritualTheme;
}
