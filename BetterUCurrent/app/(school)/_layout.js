import { Stack } from "expo-router";

export default function SchoolGroupLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#000" },
        headerTintColor: "#00ffff",
        contentStyle: { backgroundColor: "#000" },
      }}
    />
  );
}
