import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Colors } from '@/src/constants/colors';
import { Layout } from '@/src/constants/layout';
import {
  getNotifications,
  markAllRead,
  markRead,
  deleteNotification,
  type AppNotification,
} from '@/src/db/notifications';
import { useSync } from '@/src/contexts/SyncContext';

// ─── Config types ─────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<AppNotification['type'], { icon: string; color: string; label: string }> = {
  assignment: { icon: 'person-add-outline',     color: Colors.primary,  label: 'Assignation' },
  mention:    { icon: 'at-outline',             color: Colors.info,     label: 'Mention' },
  due_soon:   { icon: 'time-outline',           color: Colors.warning,  label: 'Échéance proche' },
  overdue:    { icon: 'alert-circle-outline',   color: Colors.error,    label: 'En retard' },
};

function timeAgo(iso: string): string {
  // SQLite datetime('now') returns "YYYY-MM-DD HH:MM:SS" in UTC without timezone marker.
  // Normalize to ISO 8601 with 'Z' so JS parses it as UTC, not local time.
  const normalized = iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z';
  const diffMs = Date.now() - new Date(normalized).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'À l\'instant';
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `Il y a ${diffD}j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// ─── Notification Card ────────────────────────────────────────────────────────

function NotifCard({
  notif,
  onPress,
  onDelete,
}: {
  notif: AppNotification;
  onPress: () => void;
  onDelete: () => void;
}) {
  const cfg = TYPE_CONFIG[notif.type];
  const isUnread = notif.is_read === 0;

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: cfg.color + '18' }]}>
        <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, isUnread && styles.cardTitleUnread]} numberOfLines={1}>
            {notif.titre}
          </Text>
          {isUnread && (
            <View style={[styles.newBadge, { backgroundColor: cfg.color }]}>
              <Text style={styles.newBadgeText}>Nouveau</Text>
            </View>
          )}
          <Text style={styles.cardTime}>{timeAgo(notif.created_at)}</Text>
        </View>
        {notif.corps && (
          <Text style={styles.cardCorps} numberOfLines={2}>{notif.corps}</Text>
        )}
        <View style={[styles.typePill, { backgroundColor: cfg.color + '18' }]}>
          <Text style={[styles.typePillText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>
      <Pressable onPress={onDelete} hitSlop={8} style={styles.deleteBtn}>
        <Ionicons name="close" size={16} color={Colors.textDisabled} />
      </Pressable>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { bumpSyncVersion } = useSync();
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await getNotifications(db);
      setNotifs(rows);
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  useEffect(() => { load(); }, [load]);

  const handleMarkAllRead = useCallback(async () => {
    await markAllRead(db);
    bumpSyncVersion(); // force AppHeader badge refresh
    await load();
  }, [db, load, bumpSyncVersion]);

  const handlePress = useCallback(async (notif: AppNotification) => {
    // Mark as read
    await markRead(db, notif.id);
    bumpSyncVersion();

    // Navigate to entity
    if (notif.entity_type && notif.entity_id) {
      router.push(`/(app)/${notif.entity_type}/${notif.entity_id}` as any);
    } else {
      await load();
    }
  }, [db, router, load, bumpSyncVersion]);

  const handleDelete = useCallback(async (id: number) => {
    await deleteNotification(db, id);
    bumpSyncVersion();
    await load();
  }, [db, load, bumpSyncVersion]);

  const unreadCount = notifs.filter((n) => n.is_read === 0).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>
          Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}
        </Text>
        {unreadCount > 0 && (
          <Pressable onPress={handleMarkAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Tout lire</Text>
          </Pressable>
        )}
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : notifs.length === 0 ? (
        <Animated.View entering={FadeIn.delay(200)} style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="notifications-off-outline" size={36} color={Colors.textDisabled} />
          </View>
          <Text style={styles.emptyTitle}>Aucune notification</Text>
          <Text style={styles.emptySubtitle}>
            Vous serez notifié des assignations, mentions et échéances.
          </Text>
        </Animated.View>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <NotifCard
              notif={item}
              onPress={() => handlePress(item)}
              onDelete={() => handleDelete(item.id)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.screenPaddingH,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 8,
  },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  markAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.primary + '14',
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  list: {
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: 12,
    paddingBottom: 40,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 4 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  cardTitleUnread: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  newBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
  },
  newBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  cardTime: { fontSize: 11, color: Colors.textDisabled },
  cardCorps: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  typePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  typePillText: { fontSize: 10, fontWeight: '600' },
  deleteBtn: { paddingTop: 2 },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16, fontWeight: '600',
    color: Colors.textPrimary, textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 20,
  },
});
