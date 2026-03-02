import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="note" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="tache" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="members" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}
