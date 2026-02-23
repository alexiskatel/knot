import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/src/contexts/AuthContext';
import { useSync } from '@/src/contexts/SyncContext';
import { useProjets } from '@/src/hooks/useProjets';
import { useNotes } from '@/src/hooks/useNotes';
import { Colors } from '@/src/constants/colors';
import { Layout } from '@/src/constants/layout';
import type { Note } from '@/src/db/notes';
import type { Projet } from '@/src/db/projets';

// ─── Projet card (filtre horizontal) ───────────────────────────────────────

function ProjetCard({
  projet,
  selected,
  onPress,
  totalNotes,
}: {
  projet: Projet | null;
  selected: boolean;
  onPress: () => void;
  totalNotes?: number;
}) {
  const color = projet?.couleur ?? Colors.primary;
  const opacity = useSharedValue(selected ? 1 : 0);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: withTiming(opacity.value, { duration: 180 }),
  }));

  opacity.value = selected ? 1 : 0;

  const isAll = projet === null;
  const count = isAll ? totalNotes : projet.note_count;

  return (
    <Pressable onPress={onPress} style={[styles.projetCard, { borderColor: selected ? color : Colors.border }]}>
      {/* Fond coloré quand sélectionné */}
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.projetCardBg, { backgroundColor: color }, overlayStyle]}
      />

      {/* Cercles décoratifs */}
      <View style={[styles.projetCardCircle1, { borderColor: color, opacity: selected ? 0.25 : 0.12 }]} />
      <View style={[styles.projetCardCircle2, { borderColor: color, opacity: selected ? 0.15 : 0.07 }]} />

      {/* Badge nombre de notes — coin haut gauche */}
      {count !== undefined && (
        <View style={[styles.projetCardBadge, { backgroundColor: selected ? 'rgba(255,255,255,0.2)' : color + '18' }]}>
          <Text style={[styles.projetCardBadgeText, { color: selected ? '#fff' : color }]}>
            {count}
          </Text>
        </View>
      )}

      {/* Contenu bas */}
      <View style={styles.projetCardInner}>
        {!isAll && (
          <View style={[styles.projetCardDot, { backgroundColor: selected ? 'rgba(255,255,255,0.9)' : color }]} />
        )}
        {isAll && (
          <Ionicons
            name="layers-outline"
            size={14}
            color={selected ? '#fff' : Colors.textSecondary}
            style={{ marginBottom: 4 }}
          />
        )}
        <Text
          style={[styles.projetCardLabel, { color: selected ? '#fff' : Colors.textPrimary }]}
          numberOfLines={2}
        >
          {isAll ? 'Tous' : projet.titre}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Note card ─────────────────────────────────────────────────────────────

function NoteCard({ note, onPress }: { note: Note; onPress: () => void }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const preview = note.contenu.replace(/\n/g, ' ').slice(0, 100);
  const date = new Date(note.updated_at).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
  const isPending = note.sync_status === 'pending';

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.98, { damping: 20, stiffness: 400 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 20, stiffness: 400 }); }}
        style={styles.card}
      >
        {/* Project color bar */}
        <View style={[styles.cardBar, { backgroundColor: note.projet_couleur ?? Colors.primary }]} />

        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={1}>{note.titre}</Text>
            {isPending && (
              <Ionicons name="cloud-upload-outline" size={14} color={Colors.textDisabled} />
            )}
          </View>

          {preview.length > 0 && (
            <Text style={styles.cardPreview} numberOfLines={2}>{preview}</Text>
          )}

          <View style={styles.cardMeta}>
            <View style={styles.cardMetaLeft}>
              {note.projet_titre && (
                <View style={[styles.projetTag, { backgroundColor: (note.projet_couleur ?? Colors.primary) + '18' }]}>
                  <Text style={[styles.projetTagText, { color: note.projet_couleur ?? Colors.primary }]}>
                    {note.projet_titre}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.cardDate}>{date}</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────

function EmptyNotes({ hasFilter }: { hasFilter: boolean }) {
  return (
    <Animated.View entering={FadeIn.delay(200)} style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name="document-text-outline" size={36} color={Colors.textDisabled} />
      </View>
      <Text style={styles.emptyTitle}>
        {hasFilter ? 'Aucune note dans ce projet' : 'Aucune note pour l\'instant'}
      </Text>
      <Text style={styles.emptySubtitle}>
        Appuyez sur + pour créer votre première note.
      </Text>
    </Animated.View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { team } = useAuth();
  const { sync } = useSync();
  const { projets, isLoading: projetsLoading, refresh: refreshProjets } = useProjets();
  const [selectedProjet, setSelectedProjet] = useState<Projet | null>(null);
  const { notes, isLoading: notesLoading, refresh: refreshNotes } = useNotes(selectedProjet?.id);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await sync();
    await Promise.all([refreshProjets(), refreshNotes()]);
    setRefreshing(false);
  }, [sync, refreshProjets, refreshNotes]);

  const isLoading = projetsLoading || notesLoading;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* Header */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>knot</Text>
          {team && <Text style={styles.headerTeam}>{team.nom}</Text>}
        </View>
        <Pressable style={styles.headerAction} onPress={() => router.push('/(app)/settings')}>
          <Ionicons name="ellipsis-horizontal" size={22} color={Colors.textPrimary} />
        </Pressable>
      </Animated.View>

      {/* Project filter */}
      {!projetsLoading && projets.length > 0 && (
        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            <ProjetCard
              projet={null}
              selected={selectedProjet === null}
              onPress={() => setSelectedProjet(null)}
              totalNotes={projets.reduce((sum, p) => sum + (p.note_count ?? 0), 0)}
            />
            {projets.map((p) => (
              <ProjetCard
                key={p.id}
                projet={p}
                selected={selectedProjet?.id === p.id}
                onPress={() => setSelectedProjet((prev) => prev?.id === p.id ? null : p)}
              />
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* Notes list */}
      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <NoteCard
              note={item}
              onPress={() => router.push(`/(app)/note/${item.id}`)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={<EmptyNotes hasFilter={selectedProjet !== null} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}

      {/* FAB */}
      <Animated.View entering={FadeIn.delay(300)} style={styles.fab}>
        <Pressable
          style={styles.fabBtn}
          onPress={() => router.push('/(app)/note/create')}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      </Animated.View>

    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Header
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
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },

  // Projet cards (filtre horizontal)
  chipsRow: {
    paddingHorizontal: Layout.screenPaddingH,
    paddingBottom: 14,
    gap: 10,
  },
  projetCard: {
    width: 110,
    height: 80,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  projetCardBg: {
    borderRadius: 14,
    opacity: 0,
  },
  projetCardCircle1: {
    position: 'absolute',
    top: -18,
    right: -18,
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 16,
  },
  projetCardCircle2: {
    position: 'absolute',
    top: 10,
    right: 18,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 8,
  },
  projetCardBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projetCardBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  projetCardInner: {
    padding: 10,
    gap: 4,
  },
  projetCardDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 2,
  },
  projetCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 15,
  },

  // List
  list: {
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: 4,
    paddingBottom: 100,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.cardRadius,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardBar: {
    width: 4,
  },
  cardContent: {
    flex: 1,
    padding: 14,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  cardPreview: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  cardMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  projetTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  projetTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardDate: {
    fontSize: 11,
    color: Colors.textDisabled,
  },

  // Empty
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 10,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 20,
    right: Layout.screenPaddingH,
  },
  fabBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
});
