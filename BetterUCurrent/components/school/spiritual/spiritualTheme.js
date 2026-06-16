import { campusThemeDark, campusThemeLight } from "../campusThemeTokens";

/** Shared Spiritual + school hub visuals — dark campus default (matches BetterU fitness tabs). */
export const spiritualTheme = { ...campusThemeDark };

/** Light campus palette — optional for parent portal / print-friendly views. */
export const spiritualThemeLight = { ...campusThemeLight };

export function getSpiritualTheme(mode = "dark") {
  return mode === "light" ? spiritualThemeLight : spiritualTheme;
}
