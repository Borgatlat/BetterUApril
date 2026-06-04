import { Stack } from "expo-router";
import { EmmausTriageBoard } from "../../components/emmaus/EmmausTriageBoard";

export default function EmmausTriageScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: "Emmaus Companion Network",
          headerShown: true,
          headerStyle: { backgroundColor: "#050708" },
          headerTintColor: "#00e5e5",
          headerTitleStyle: { fontWeight: "800", fontSize: 17 },
        }}
      />
      <EmmausTriageBoard />
    </>
  );
}
