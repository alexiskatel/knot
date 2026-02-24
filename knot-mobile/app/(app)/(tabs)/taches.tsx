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
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { useSync } from '@/src/contexts/SyncContext';
import { useTaches } from '@/src/hooks/useTaches';
import { useProjets } from '@/src/hooks/useProjets';
import { AppHeader } from '@/src/components/shared/AppHeader';
import { Colors } from '@/src/constants/colors';
import { Layout } from '@/src/constants/layout';
import type { Tache } from '@/src/db/taches';
import type { Projet } from '@/src/db/projets';

// ─── Statut config ────────────────────────────────────────────────────────────

const STATUTS = [
  { key: 'todo',     label: 'À faire',    color: Colors.todo },
  { key: 'en_cours', label: 'En cours',   color: Colors.en_cours },
  { key: 'done',     label: 'Terminé',    color: Colors.done },
] as const;

type StatutFilter = 'all' | 'todo' | 'en_cours' | 'done';

function statutLabel(s: string) {
  return STATUTS.find((x) => x.key === s)?.label ?? s;
}
function statutColor(s: string) {
  return STATUTS.find((x) => x.key === s)?.color ?? Colors.textSecondary;
}

// ─── Tache Card ───────────────────────────────────────────────────────────────

function TacheCard({ tache, onPress }: { tache: Tache; onPress: () => void }) {
  const color = tache.projet_couleur ?? Colors.primary;
  const sColor = statutColor(tache.statut);
  const isPending = tache.sync_status === 'pending';

  const assigneLabel = tache.assigne_prenom
    ? `${tache.assigne_prenom} ${tache.assigne_nom}`
    : tache.assigne_nom ?? null;

  const dueDateStr = tache.due_date
    ? new Date(tache.due_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    : null;

  const isOverdue = tache.due_date
    && tache.statut !== 'done'
    && new Date(tache.due_date) < new Date();

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={[styles.cardBar, { backgroundColor: color }]} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>{tache.titre}</Text>
          {isPending && <Ionicons name="cloud-upload-outline" size={14} color={Colors.textDisabled} />}
        </View>

        {tache.description && (
          <Text style={styles.cardDesc} numberOfLines={2}>{tache.description}</Text>
        )}

        <View style={styles.cardMeta}>
          <View style={[styles.statutPill, { backgroundColor: sColor + '20' }]}>
            <View style={[styles.statutDot, { backgroundColor: sColor }]} />
            <Text style={[styles.statutPillText, { color: sColor }]}>
              {statutLabel(tache.statut)}
            </Text>
          </View>

          <View style={styles.cardMetaRight}>
            {assigneLabel && (
              <View style={styles.assigneRow}>
                <Ionicons name="person-outline" size={11} color={Colors.textDisabled} />
                <Text style={styles.assigneText} numberOfLines={1}>{assigneLabel}</Text>
              </View>
            )}
            {dueDateStr && (
              <View style={styles.dueDateRow}>
                <Ionicons
                  name="calendar-outline"
                  size={11}
                  color={isOverdue ? Colors.error : Colors.textDisabled}
                />
                <Text style={[styles.dueDateText, isOverdue && { color: Colors.error }]}>
                  {dueDateStr}
                </Text>
              </View>
            )}
          </View>
        </View>

        {tache.projet_titre && (
          <View style={[styles.projetTag, { backgroundColor: color + '18' }]}>
            <Text style={[styles.projetTagText, { color }]}>{tache.projet_titre}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyTaches({ hasFilter }: { hasFilter: boolean }) {
  return (
    <Animated.View entering={FadeIn.delay(200)} style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name="checkmark-circle-outline" size={36} color={Colors.textDisabled} />
      </View>
      <Text style={styles.emptyTitle}>
        {hasFilter ? 'Aucune tâche pour ce filtre' : 'Aucune tâche pour l\'instant'}
      </Text>
      <Text style={styles.emptySubtitle}>
        Appuyez sur + pour créer une tâche.
      </Text>
    </Animated.View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function TachesScreen() {
  const router = useRouter();
  const { sync } = useSync();
  const { projets } = useProjets();
  const [selectedProjet, setSelectedProjet] = useState<Projet | null>(null);
  const [selectedStatut, setSelectedStatut] = useState<StatutFilter>('all');
  const { taches, isLoading, refresh } = useTaches(selectedProjet?.id);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await sync();
    await refresh();
    setRefreshing(false);
  }, [sync, refresh]);

  const filtered = selectedStatut === 'all'
    ? taches
    : taches.filter((t) => t.statut === selectedStatut);

  const hasFilter = selectedProjet !== null || selectedStatut !== 'all';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      <AppHeader />

      {/* Filtres statuts */}
      <View style={styles.statutFilters}>
        <Pressable
          onPress={() => setSelectedStatut('all')}
          style={[styles.statutFilter, selectedStatut === 'all' && styles.statutFilterActive]}
        >
          <Text style={[styles.statutFilterText, selectedStatut === 'all' && styles.statutFilterTextActive]}>
            Toutes
          </Text>
        </Pressable>
        {STATUTS.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => setSelectedStatut(selectedStatut === s.key ? 'all' : s.key)}
            style={[
              styles.statutFilter,
              selectedStatut === s.key && { backgroundColor: s.color + '20', borderColor: s.color },
            ]}
          >
            <View style={[styles.statutDot, { backgroundColor: s.color }]} />
            <Text style={[styles.statutFilterText, selectedStatut === s.key && { color: s.color }]}>
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Filtres projets */}
      {projets.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.projetChips}
        >
          <Pressable
            onPress={() => setSelectedProjet(null)}
            style={[styles.projetChip, selectedProjet === null && styles.projetChipActive]}
          >
            <Text style={[styles.projetChipText, selectedProjet === null && styles.projetChipTextActive]}>
              Tous
            </Text>
          </Pressable>
          {projets.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => setSelectedProjet((prev) => prev?.id === p.id ? null : p)}
              style={[
                styles.projetChip,
                selectedProjet?.id === p.id && { backgroundColor: p.couleur + '20', borderColor: p.couleur },
              ]}
            >
              <View style={[styles.projetChipDot, { backgroundColor: p.couleur }]} />
              <Text style={[
                styles.projetChipText,
                selectedProjet?.id === p.id && { color: p.couleur },
              ]}>
                {p.titre}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Liste */}
      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <TacheCard
              tache={item}
              onPress={() => router.push(`/(app)/tache/${item.id}`)}
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
          ListEmptyComponent={<EmptyTaches hasFilter={hasFilter} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}

      {/* FAB */}
      <Animated.View entering={FadeIn.delay(300)} style={styles.fab}>
        <Pressable
          style={styles.fabBtn}
          onPress={() => router.push('/(app)/tache/create')}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      </Animated.View>

    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  // Statut filters
  statutFilters: {
    flexDirection: 'row',
    paddingHorizontal: Layout.screenPaddingH,
    gap: 8,
    paddingBottom: 12,
    flexWrap: 'wrap',
  },
  statutFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statutFilterActive: {
    backgroundColor: Colors.primary + '18',
    borderColor: Colors.primary,
  },
  statutFilterText: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  statutFilterTextActive: { color: Colors.primary },
  statutDot: { width: 7, height: 7, borderRadius: 3.5 },

  // Projet chips
  projetChips: {
    paddingHorizontal: Layout.screenPaddingH,
    paddingBottom: 14,
    gap: 8,
  },
  projetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  projetChipActive: {
    backgroundColor: Colors.primary + '18',
    borderColor: Colors.primary,
  },
  projetChipDot: { width: 8, height: 8, borderRadius: 4 },
  projetChipText: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  projetChipTextActive: { color: Colors.primary },

  // List
  list: {
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: 4,
    paddingBottom: 100,
  },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

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
  cardBar: { width: 4 },
  cardContent: { flex: 1, padding: 14, gap: 6 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  cardDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  cardMetaRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  statutPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statutPillText: { fontSize: 11, fontWeight: '600' },

  assigneRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  assigneText: { fontSize: 11, color: Colors.textDisabled, maxWidth: 80 },
  dueDateRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dueDateText: { fontSize: 11, color: Colors.textDisabled },

  projetTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 2,
  },
  projetTagText: { fontSize: 11, fontWeight: '600' },

  // Empty
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  // FAB
  fab: { position: 'absolute', bottom: 20, right: Layout.screenPaddingH },
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
