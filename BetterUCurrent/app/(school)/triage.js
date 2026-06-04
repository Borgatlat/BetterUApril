import { Stack } from "expo-router";
import { CounselorTriageGrid } from "../../components/school/CounselorTriageGrid";

/**
 * Counselor triage queue route.
 * URL: /(school)/triage
 *
 * Expo Router treats every file in /app as a route. The Stack.Screen wrapper
 * configures the navigation bar styling to match the existing school dashboard.
 */
export default function CounselorTriageScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: "MTSS Triage Queue",
          headerShown: true,
          headerStyle: { backgroundColor: "#050708" },
          headerTintColor: "#00e5e5",
          headerTitleStyle: { fontWeight: "800", fontSize: 17 },
        }}
      />
      <CounselorTriageGrid />
    </>
  );
}
