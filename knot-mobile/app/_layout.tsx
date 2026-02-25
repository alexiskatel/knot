import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { Suspense, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import 'react-native-reanimated';
import * as Notifications from 'expo-notifications';

import { migrateDbIfNeeded } from '@/src/db/migrations';
import { AuthProvider } from '@/src/contexts/AuthContext';
import { SyncProvider } from '@/src/contexts/SyncContext';
import { Colors } from '@/src/constants/colors';
import { requestNotificationPermissions } from '@/src/services/pushNotifications';

function LoadingScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
      <ActivityIndicator color={Colors.primary} size="large" />
    </View>
  );
}

function NotificationNavigator() {
  const router = useRouter();

  useEffect(() => {
    // Request permissions on first launch
    requestNotificationPermissions().catch(() => {});

    // Handle tap on a push notification → navigate to the entity
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      if (data.entity_type && data.entity_id) {
        const path = data.entity_type === 'note'
          ? `/(app)/note/${data.entity_id}`
          : `/(app)/tache/${data.entity_id}`;
        router.push(path as any);
      } else {
        router.push('/(app)/notifications' as any);
      }
    });
    return () => sub.remove();
  }, [router]);

  return null;
}

export default function RootLayout() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <SQLiteProvider databaseName="knot.db" onInit={migrateDbIfNeeded} useSuspense>
        <AuthProvider>
          <SyncProvider>
            <NotificationNavigator />
            <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(app)" />
              <Stack.Screen name="+not-found" />
            </Stack>
            <StatusBar style="dark" />
          </SyncProvider>
        </AuthProvider>
      </SQLiteProvider>
    </Suspense>
  );
}
