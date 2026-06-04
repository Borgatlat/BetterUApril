import { Stack } from "expo-router";
import { AdministrativeAssignmentsGrid } from "../../components/school/AdministrativeAssignmentsGrid";

/**
 * Reflective disciplinary portal route.
 * URL: /(school)/disciplinary
 */
export default function DisciplinaryPortalScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: "Reflective assignments",
          headerShown: true,
          headerStyle: { backgroundColor: "#050708" },
          headerTintColor: "#00e5e5",
          headerTitleStyle: { fontWeight: "800", fontSize: 17 },
        }}
      />
      <AdministrativeAssignmentsGrid />
    </>
  );
}
