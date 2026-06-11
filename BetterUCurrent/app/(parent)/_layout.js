import { Stack } from "expo-router";
import { campusThemeLight } from "../../components/school/campusThemeTokens";

/** Parent workspace — service hours + wellness summary (FERPA-safe). */
export default function ParentGroupLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: campusThemeLight.cardBg },
        headerTintColor: campusThemeLight.accent,
        headerTitleStyle: { fontWeight: "800" },
        contentStyle: { backgroundColor: campusThemeLight.screenBg },
      }}
    />
  );
}
