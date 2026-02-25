import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  Pressable,
  Modal,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { useSync } from '@/src/contexts/SyncContext';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTaches } from '@/src/hooks/useTaches';
import { useProjets } from '@/src/hooks/useProjets';
import { AppHeader } from '@/src/components/shared/AppHeader';
import { Colors } from '@/src/constants/colors';
import { Layout } from '@/src/constants/layout';
import type { Tache } from '@/src/db/taches';
import type { Projet } from '@/src/db/projets';

interface Membre { id: number; nom: string; prenom: string | null; }
function membreLabel(m: Membre) { return m.prenom ? `${m.prenom} ${m.nom}` : m.nom; }

// ─── Statut config ────────────────────────────────────────────────────────────

const STATUTS = [
  { key: 'todo',     label: 'À faire',    color: Colors.todo },
  { key: 'en_cours', label: 'En cours',   color: Colors.en_cours },
  { key: 'done',     label: 'Terminé',    color: Colors.done },
] as const;

type StatutFilter = 'all' | 'todo' | 'en_cours' | 'done' | 'overdue';

function statutLabel(s: string) {
  return STATUTS.find((x) => x.key === s)?.label ?? s;
}
function statutColor(s: string) {
  return STATUTS.find((x) => x.key === s)?.color ?? Colors.textSecondary;
}

// ─── Projet filter card ──────────────────────────────────────────────────────
// Même style que les cartes de projet sur la page des notes

function ProjetFilterCard({
  projet,
  selected,
  count,
  onPress,
}: {
  projet: Projet | null;
  selected: boolean;
  count: number;
  onPress: () => void;
}) {
  const color = projet?.couleur ?? Colors.primary;
  const opacity = useSharedValue(selected ? 1 : 0);
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: withTiming(opacity.value, { duration: 180 }),
  }));
  opacity.value = selected ? 1 : 0;
  const isAll = projet === null;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.projetCard, { borderColor: selected ? color : Colors.border }]}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.projetCardBg, { backgroundColor: color }, overlayStyle]}
      />
      {/* Cercles décoratifs */}
      <View style={[styles.projetCardCircle1, { borderColor: color, opacity: selected ? 0.25 : 0.12 }]} />
      <View style={[styles.projetCardCircle2, { borderColor: color, opacity: selected ? 0.15 : 0.07 }]} />

      {/* Badge count */}
      <View style={[styles.projetCardBadge, { backgroundColor: selected ? 'rgba(255,255,255,0.2)' : color + '18' }]}>
        <Text style={[styles.projetCardBadgeText, { color: selected ? '#fff' : color }]}>{count}</Text>
      </View>

      {/* Label bas */}
      <View style={styles.projetCardInner}>
        {isAll
          ? <Ionicons name="layers-outline" size={13} color={selected ? '#fff' : Colors.textSecondary} style={{ marginBottom: 3 }} />
          : <View style={[styles.projetCardDot, { backgroundColor: selected ? 'rgba(255,255,255,0.9)' : color }]} />
        }
        <Text style={[styles.projetCardLabel, { color: selected ? '#fff' : Colors.textPrimary }]} numberOfLines={2}>
          {isAll ? 'Toutes' : projet.titre}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Tache Card ───────────────────────────────────────────────────────────────
// Carte compacte — une ligne titre, une ligne meta

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

  const now = Date.now();
  const dueMs = tache.due_date ? new Date(tache.due_date).getTime() : null;
  const isOverdue = dueMs !== null && tache.statut !== 'done' && dueMs < now;
  const daysLeft = dueMs !== null && tache.statut !== 'done' && !isOverdue
    ? Math.ceil((dueMs - now) / (24 * 60 * 60 * 1000))
    : null;
  const isDueUrgent = daysLeft !== null && daysLeft <= 2;

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={[styles.cardBar, { backgroundColor: color }]} />

      {/* Cercles décoratifs en fond */}
      <View style={[styles.cardCircle1, { borderColor: color }]} />
      <View style={[styles.cardCircle2, { borderColor: color }]} />

      <View style={styles.cardContent}>
        {/* Ligne 1 : titre + badges urgence + pending */}
        <View style={styles.cardRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>{tache.titre}</Text>
          <View style={styles.cardRowRight}>
            {isOverdue && (
              <View style={styles.overdueBadge}>
                <Text style={styles.overdueBadgeText}>En retard</Text>
              </View>
            )}
            {daysLeft !== null && (
              <View style={isDueUrgent ? styles.dueUrgentBadge : styles.dueSoonBadge}>
                <Text style={isDueUrgent ? styles.dueUrgentBadgeText : styles.dueSoonBadgeText}>
                  J-{daysLeft}
                </Text>
              </View>
            )}
            {isPending && <Ionicons name="cloud-upload-outline" size={13} color={Colors.textDisabled} />}
          </View>
        </View>

        {/* Ligne 2 : statut + assigné + date */}
        <View style={styles.cardMeta}>
          <View style={[styles.statutPill, { backgroundColor: sColor + '20' }]}>
            <View style={[styles.statutDot, { backgroundColor: sColor }]} />
            <Text style={[styles.statutPillText, { color: sColor }]}>{statutLabel(tache.statut)}</Text>
          </View>

          <View style={styles.cardMetaRight}>
            {(tache.commentaire_count ?? 0) > 0 && (
              <View style={styles.metaChip}>
                <Ionicons name="chatbubble-outline" size={10} color={Colors.textDisabled} />
                <Text style={styles.metaChipText}>{tache.commentaire_count}</Text>
              </View>
            )}
            {assigneLabel && (
              <View style={styles.metaChip}>
                <Ionicons name="person-outline" size={10} color={Colors.textDisabled} />
                <Text style={styles.metaChipText} numberOfLines={1}>{assigneLabel}</Text>
              </View>
            )}
            {dueDateStr && (
              <View style={styles.metaChip}>
                <Ionicons
                  name="calendar-outline"
                  size={10}
                  color={isOverdue ? Colors.error : isDueUrgent ? Colors.error : daysLeft !== null ? Colors.warning : Colors.textDisabled}
                />
                <Text style={[
                  styles.metaChipText,
                  isOverdue && { color: Colors.error },
                  !isOverdue && isDueUrgent && { color: Colors.error },
                  !isOverdue && !isDueUrgent && daysLeft !== null && { color: Colors.warning },
                ]}>{dueDateStr}</Text>
              </View>
            )}
          </View>
        </View>
        {tache.projet_titre && <Text style={[styles.overdueBadgeText, {color: tache.projet_couleur}]}> {tache.projet_titre} </Text>}
        

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
  const db = useSQLiteContext();
  const { sync } = useSync();
  const { team } = useAuth();
  const { projets } = useProjets();
  const [selectedProjet, setSelectedProjet] = useState<Projet | null>(null);
  const [selectedStatut, setSelectedStatut] = useState<StatutFilter>('all');
  const [selectedMembreId, setSelectedMembreId] = useState<number | null>(null);
  const [membres, setMembres] = useState<Membre[]>([]);
  const [showMembrePicker, setShowMembrePicker] = useState(false);
  const { taches, isLoading, refresh } = useTaches(selectedProjet?.id);
  const [refreshing, setRefreshing] = useState(false);

  // Chargement des membres de l'équipe
  useEffect(() => {
    async function loadMembres() {
      if (!team) return;
      const localTeam = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM teams WHERE server_id = ?', team.id,
      );
      if (!localTeam) return;
      const rows = await db.getAllAsync<Membre>(
        'SELECT id, nom, prenom FROM users WHERE team_id = ? ORDER BY prenom, nom',
        localTeam.id,
      );
      setMembres(rows);
    }
    loadMembres();
  }, [db, team]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await sync();
    await refresh();
    setRefreshing(false);
  }, [sync, refresh]);

  const filtered = (() => {
    let result = taches;
    // Filtre membre
    if (selectedMembreId !== null) {
      result = result.filter((t) => t.assigne_id === selectedMembreId);
    }
    // Filtre statut
    if (selectedStatut === 'overdue') {
      const now = Date.now();
      return result.filter((t) => t.due_date && t.statut !== 'done' && new Date(t.due_date).getTime() < now);
    }
    if (selectedStatut !== 'all') {
      result = result.filter((t) => t.statut === selectedStatut);
    }
    return result;
  })();

  const overdueCount = taches.filter(
    (t) => t.due_date && t.statut !== 'done' && new Date(t.due_date).getTime() < Date.now(),
  ).length;

  const hasFilter = selectedProjet !== null || selectedStatut !== 'all' || selectedMembreId !== null;

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
        <Pressable
          onPress={() => setSelectedStatut(selectedStatut === 'overdue' ? 'all' : 'overdue')}
          style={[
            styles.statutFilter,
            selectedStatut === 'overdue' && { backgroundColor: Colors.error + '20', borderColor: Colors.error },
          ]}
        >
          <Ionicons
            name="alert-circle-outline"
            size={12}
            color={selectedStatut === 'overdue' ? Colors.error : Colors.textSecondary}
          />
          <Text style={[styles.statutFilterText, selectedStatut === 'overdue' && { color: Colors.error }]}>
            En retard{overdueCount > 0 ? ` (${overdueCount})` : ''}
          </Text>
        </Pressable>
      </View>

      {/* Filtre membre — dropdown */}
      {membres.length > 0 && (
        <View style={styles.membreFilterRow}>
          <Pressable
            onPress={() => setShowMembrePicker(true)}
            style={[styles.membreDropdown, selectedMembreId !== null && styles.membreDropdownActive]}
          >
            <Ionicons
              name="person-outline"
              size={14}
              color={selectedMembreId !== null ? Colors.primary : Colors.textSecondary}
            />
            <Text style={[styles.membreDropdownText, selectedMembreId !== null && styles.membreDropdownTextActive]}>
              {selectedMembreId !== null
                ? membreLabel(membres.find((m) => m.id === selectedMembreId)!)
                : 'Assigné à : '}
            </Text>
            <Ionicons name="chevron-down" size={13} color={selectedMembreId !== null ? Colors.primary : Colors.textSecondary} />
          </Pressable>
          {selectedMembreId !== null && (
            <Pressable onPress={() => setSelectedMembreId(null)} style={styles.membreClearBtn} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={Colors.textDisabled} />
            </Pressable>
          )}
        </View>
      )}

      {/* Modal picker membre */}
      <Modal visible={showMembrePicker} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowMembrePicker(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Filtrer par membre</Text>
          <FlatList
            data={[{ id: -1, nom: 'Assigné à : ', prenom: null } as Membre, ...membres]}
            keyExtractor={(m) => String(m.id)}
            renderItem={({ item }) => {
              const isAll = item.id === -1;
              const isSelected = isAll ? selectedMembreId === null : selectedMembreId === item.id;
              return (
                <Pressable
                  onPress={() => {
                    setSelectedMembreId(isAll ? null : item.id);
                    setShowMembrePicker(false);
                  }}
                  style={[styles.modalOption, isSelected && styles.modalOptionSelected]}
                >
                  <Ionicons
                    name={isAll ? 'people-outline' : 'person-circle-outline'}
                    size={20}
                    color={isSelected ? Colors.primary : Colors.textSecondary}
                  />
                  <Text style={[styles.modalOptionText, isSelected && { color: Colors.primary, fontWeight: '600' }]}>
                    {isAll ? 'Assigné à : ' : membreLabel(item)}
                  </Text>
                  {isSelected && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>

      {/* Filtres projets — style cartes avec cercles + count */}
      {projets.length > 0 && (
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.projetCardsRow}
          >
            <ProjetFilterCard
              projet={null}
              selected={selectedProjet === null}
              count={taches.length}
              onPress={() => setSelectedProjet(null)}
            />
            {projets.map((p) => (
              <ProjetFilterCard
                key={p.id}
                projet={p}
                selected={selectedProjet?.id === p.id}
                count={taches.filter((t) => t.projet_id === p.id).length}
                onPress={() => setSelectedProjet((prev) => prev?.id === p.id ? null : p)}
              />
            ))}
          </ScrollView>
        </Animated.View>
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
  statutDot: { width: 6, height: 6, borderRadius: 3 },

  // Membre filter dropdown
  membreFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.screenPaddingH,
    paddingBottom: 12,
    gap: 8,
  },
  membreDropdown: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  membreDropdownActive: {
    backgroundColor: Colors.primary + '0E',
    borderColor: Colors.primary,
  },
  membreDropdownText: { flex: 1, fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  membreDropdownTextActive: { color: Colors.primary },
  membreClearBtn: { padding: 2 },

  // Modal membre picker
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay },
  modalSheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '60%',
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 12, marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16, fontWeight: '600', color: Colors.textPrimary,
    paddingHorizontal: Layout.screenPaddingH, paddingBottom: 12,
  },
  modalOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Layout.screenPaddingH, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  modalOptionSelected: { backgroundColor: Colors.surfaceAlt },
  modalOptionText: { flex: 1, fontSize: 15, color: Colors.textPrimary },

  // Projet filter cards (style identique à la page notes)
  projetCardsRow: {
    paddingHorizontal: Layout.screenPaddingH,
    paddingBottom: 14,
    gap: 10,
  },
  projetCard: {
    width: 100,
    height: 74,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  projetCardBg: { borderRadius: 14, opacity: 0 },
  projetCardCircle1: {
    position: 'absolute',
    top: -16, right: -16,
    width: 64, height: 64,
    borderRadius: 32,
    borderWidth: 14,
  },
  projetCardCircle2: {
    position: 'absolute',
    top: 8, right: 14,
    width: 32, height: 32,
    borderRadius: 16,
    borderWidth: 7,
  },
  projetCardBadge: {
    position: 'absolute',
    top: 7, right: 8,
    minWidth: 20, height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center',
  },
  projetCardBadgeText: { fontSize: 10, fontWeight: '700' },
  projetCardInner: { padding: 8, gap: 3 },
  projetCardDot: { width: 7, height: 7, borderRadius: 3.5, marginBottom: 2 },
  projetCardLabel: { fontSize: 11, fontWeight: '600', lineHeight: 14 },

  // List
  list: {
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: 4,
    paddingBottom: 100,
  },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Tache card — compacte
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.cardRadius,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardBar: { width: 4 },
  // Cercles décoratifs en fond de carte
  cardCircle1: {
    position: 'absolute',
    top: -20, right: -20,
    width: 70, height: 70,
    borderRadius: 35,
    borderWidth: 14,
    opacity: 0.07,
  },
  cardCircle2: {
    position: 'absolute',
    top: 6, right: 20,
    width: 36, height: 36,
    borderRadius: 18,
    borderWidth: 8,
    opacity: 0.05,
  },
  cardContent: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 5 },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardMetaRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  statutPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  statutPillText: { fontSize: 10, fontWeight: '600' },

  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaChipText: { fontSize: 10, color: Colors.textDisabled, maxWidth: 70 },

  cardRowRight: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  overdueBadge: {
    backgroundColor: Colors.error + '22',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  overdueBadgeText: { fontSize: 9, fontWeight: '700', color: Colors.error },
  dueSoonBadge: {
    backgroundColor: Colors.warning + '22',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dueSoonBadgeText: { fontSize: 9, fontWeight: '700', color: Colors.warning },
  dueUrgentBadge: {
    backgroundColor: Colors.error + '22',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dueUrgentBadgeText: { fontSize: 9, fontWeight: '700', color: Colors.error },

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
