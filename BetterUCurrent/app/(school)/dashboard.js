import { Stack } from "expo-router";
import { SentinelStaffDashboard } from "../../components/school/SentinelStaffDashboard";

/**
 * Staff stack (admin / counselor): web-tablet friendly single scroll screen.
 * Router entry: /(school)/dashboard
 */
export default function StaffDashboardScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: "Leadership wellness",
          headerShown: true,
          headerStyle: { backgroundColor: "#050708" },
          headerTintColor: "#00e5e5",
          headerTitleStyle: { fontWeight: "800", fontSize: 17 },
        }}
      />
      <SentinelStaffDashboard />
    </>
  );
}
