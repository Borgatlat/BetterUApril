import { Stack } from 'expo-router';

export default function AccountabilityLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0a0a0a' },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="add-partner" />
      <Stack.Screen name="check-in" />
    </Stack>
  );
}
