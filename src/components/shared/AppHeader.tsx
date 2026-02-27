import { Colors } from '@/src/constants/colors';
import { Layout } from '@/src/constants/layout';
import { useAuth } from '@/src/contexts/AuthContext';
import { useSync } from '@/src/contexts/SyncContext';
import { getUnreadCount } from '@/src/db/notifications';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';

export function AppHeader() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { team } = useAuth();
  const { sync, isSyncing, syncVersion } = useSync();
  const [unreadCount, setUnreadCount] = useState(0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    getUnreadCount(db).then(setUnreadCount).catch(() => {});
  }, [db, syncVersion]);

  useEffect(() => {
    if (isSyncing) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 900, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      cancelAnimation(rotation);
      rotation.value = withTiming(0, { duration: 200 });
    }
  }, [isSyncing]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.headerTitle}>knot</Text>
        {team && <Text style={styles.headerTeam}>{team.nom}</Text>}
      </View>

      <View style={styles.headerActions}>
        {/* Bouton notifications */}
        <Pressable
          onPress={() => router.push('/(app)/notifications' as any)}
          style={styles.headerAction}
        >
          <Ionicons name="notifications-outline" size={22} color={Colors.textPrimary} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </Pressable>

        {/* Bouton sync */}
        <Pressable onPress={sync} style={styles.headerAction} accessibilityLabel="Synchroniser">
          <Animated.View style={animStyle}>
            <Ionicons
              name="sync-outline"
              size={22}
              color={isSyncing ? Colors.primary : Colors.textPrimary}
            />
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.screenPaddingH,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  headerTeam: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
});
