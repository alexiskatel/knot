import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { Suspense } from 'react';
import { View, ActivityIndicator } from 'react-native';
import 'react-native-reanimated';

import { migrateDbIfNeeded } from '@/src/db/migrations';
import { AuthProvider } from '@/src/contexts/AuthContext';
import { SyncProvider } from '@/src/contexts/SyncContext';
import { Colors } from '@/src/constants/colors';

function LoadingScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
      <ActivityIndicator color={Colors.primary} size="large" />
    </View>
  );
}

export default function RootLayout() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <SQLiteProvider databaseName="knot.db" onInit={migrateDbIfNeeded} useSuspense>
        <AuthProvider>
          <SyncProvider>
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
