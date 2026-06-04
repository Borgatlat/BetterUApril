import { Stack } from "expo-router";
import { FocusLockScreen } from "../components/school/FocusLockScreen";

/**
 * Phone-Free Focus Mode route.
 * URL: /focus-lock
 *
 * Intentionally placed at the top level of /app (NOT inside (tabs)) so the tab
 * bar is hidden — distraction-free, full-bleed timer surface.
 * headerShown: false so the screen owns the entire viewport.
 */
export default function FocusLockRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          gestureEnabled: false, // students cannot swipe back to skip the AppState guard
          animation: "fade",
        }}
      />
      <FocusLockScreen />
    </>
  );
}
