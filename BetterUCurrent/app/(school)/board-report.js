import { Stack } from "expo-router";
import { BoardReportExport } from "../../components/school/BoardReportExport";

/**
 * Admin "One-Click Board Report" route.
 * URL: /(school)/board-report
 */
export default function BoardReportScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: "Board report",
          headerShown: true,
          headerStyle: { backgroundColor: "#050708" },
          headerTintColor: "#00e5e5",
          headerTitleStyle: { fontWeight: "800", fontSize: 17 },
        }}
      />
      <BoardReportExport />
    </>
  );
}
