import { useState, useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/src/contexts/AuthContext';
import { api } from '@/src/api/client';
import { AppHeader } from '@/src/components/shared/AppHeader';
import { Colors } from '@/src/constants/colors';
import { Layout } from '@/src/constants/layout';

// ── Types ─────────────────────────────────────────────────────────────────────

type TabType = 'notes' | 'taches' | 'projets';

interface TrashedItem {
  id: number;
  titre: string;
  deleted_at: string;
  deleted_by?: number | null;
  deleted_by_user?: { nom: string; prenom: string | null } | null;
  projet_id?: number;
  statut?: string;
  due_date?: string;
  notes_count?: number;
  taches_count?: number;
  couleur?: string;
  projet?: { titre: string; couleur: string };
}

interface ActiveProjet {
  id: number;
  titre: string;
  couleur: string;
}

type DateFilter = 'all' | 'today' | 'week' | 'month';

const DATE_FILTER_LABELS: Record<DateFilter, string> = {
  all: 'Tout',
  today: "Aujourd'hui",
  week: 'Cette semaine',
  month: 'Ce mois',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function normDate(s: string) {
  return s.includes('T') ? s : s.replace(' ', 'T') + 'Z';
}

function formatDeletedAt(iso: string) {
  return new Date(normDate(iso)).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDateRange(filter: DateFilter): { from?: string; to?: string } {
  const now = new Date();
  if (filter === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { from: start.toISOString(), to: now.toISOString() };
  }
  if (filter === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    return { from: start.toISOString(), to: now.toISOString() };
  }
  if (filter === 'month') {
    const start = new Date(now);
    start.setMonth(now.getMonth() - 1);
    return { from: start.toISOString(), to: now.toISOString() };
  }
  return {};
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CorbeilleScreen() {
  const { team } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('notes');
  const [items, setItems] = useState<TrashedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRestoring, setIsRestoring] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedProjetId, setSelectedProjetId] = useState<number | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [projets, setProjets] = useState<ActiveProjet[]>([]);

  // Guard against stale responses when team changes mid-request
  const loadIdRef = useRef(0);

  // Dropdowns
  const [showProjetPicker, setShowProjetPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Reset filters when the active team changes
  useEffect(() => {
    setItems([]);
    setSelectedProjetId(null);
    setSearch('');
    setError(null);
  }, [team?.id]);

  // Load active projets for filter
  useEffect(() => {
    if (!team) return;
    api.get<any>(`/teams/${team.id}/projets?all=1`).then((res) => {
      const list: any[] = Array.isArray(res?.list) ? res.list
        : Array.isArray(res?.list?.data) ? res.list.data
        : [];
      setProjets(list.map((p: any) => ({ id: p.id, titre: p.titre, couleur: p.couleur ?? Colors.primary })));
    }).catch(() => {});
  }, [team?.id]);

  const load = useCallback(async (refreshing = false) => {
    if (!team) return;
    const myLoadId = ++loadIdRef.current;
    if (refreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type: activeTab });
      if (search.trim()) params.set('search', search.trim());
      if (selectedProjetId && activeTab !== 'projets') params.set('projet_id', String(selectedProjetId));
      const { from, to } = getDateRange(dateFilter);
      if (from) params.set('deleted_from', from);
      if (to) params.set('deleted_to', to);

      const res = await api.get<any>(`/admin/trash?${params.toString()}`);
      if (myLoadId !== loadIdRef.current) return; // réponse périmée, groupe changé
      const list: TrashedItem[] = Array.isArray(res?.list) ? res.list
        : Array.isArray(res?.list?.list) ? res.list.list
        : Array.isArray(res?.list?.data) ? res.list.data
        : [];
      setItems(list);
    } catch (e: any) {
      if (myLoadId !== loadIdRef.current) return;
      const msg = e?.response?.status === 403
        ? 'Accès refusé — votre compte n\'a pas les droits admin.'
        : 'Impossible de charger la corbeille. Vérifiez la connexion.';
      setError(msg);
      console.warn('[Corbeille] Chargement échoué:', e);
    } finally {
      if (myLoadId === loadIdRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [team, activeTab, search, selectedProjetId, dateFilter]);

  useEffect(() => { load(); }, [load]);

  // Recharge aussi à chaque fois que l'onglet reprend le focus
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleRestore = useCallback((item: TrashedItem) => {
    Alert.alert(
      'Restaurer cet élément',
      `Voulez-vous restaurer "${item.titre}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Restaurer',
          onPress: async () => {
            setIsRestoring(item.id);
            try {
              await api.post(`/admin/trash/${activeTab}/${item.id}/restore`, {});
              setItems((prev) => prev.filter((i) => i.id !== item.id));
            } catch {
              Alert.alert('Erreur', 'Impossible de restaurer cet élément.');
            } finally {
              setIsRestoring(null);
            }
          },
        },
      ],
    );
  }, [activeTab]);

  const selectedProjet = projets.find((p) => p.id === selectedProjetId);

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderItem = ({ item }: { item: TrashedItem }) => {
    const isBeingRestored = isRestoring === item.id;
    const projetColor = item.projet?.couleur ?? item.couleur ?? Colors.primary;

    return (
      <View style={styles.card}>
        <View style={styles.cardBody}>
          {item.projet && (
            <View style={[styles.projetTag, { backgroundColor: projetColor + '20' }]}>
              <View style={[styles.projetDot, { backgroundColor: projetColor }]} />
              <Text style={[styles.projetTagText, { color: projetColor }]}>{item.projet.titre}</Text>
            </View>
          )}

          <Text style={styles.cardTitle} numberOfLines={2}>{item.titre}</Text>

          {activeTab === 'projets' && (item.notes_count !== undefined || item.taches_count !== undefined) && (
            <Text style={styles.cascadeText}>
              {item.notes_count ?? 0} note{(item.notes_count ?? 0) !== 1 ? 's' : ''}
              {'  ·  '}
              {item.taches_count ?? 0} tâche{(item.taches_count ?? 0) !== 1 ? 's' : ''}
            </Text>
          )}

          <View style={styles.cardMeta}>
            <Ionicons name="trash-outline" size={12} color={Colors.textDisabled} />
            <Text style={styles.deletedAtText}>{formatDeletedAt(item.deleted_at)}</Text>
          </View>

          {item.deleted_by_user && (
            <View style={styles.deletedByRow}>
              <Ionicons name="person-outline" size={11} color={Colors.textDisabled} />
              <Text style={styles.deletedByText}>
                {item.deleted_by_user.prenom
                  ? `${item.deleted_by_user.prenom} ${item.deleted_by_user.nom}`
                  : item.deleted_by_user.nom}
              </Text>
            </View>
          )}
        </View>

        <Pressable
          onPress={() => handleRestore(item)}
          disabled={isBeingRestored}
          style={[styles.restoreBtn, isBeingRestored && styles.restoreBtnDisabled]}
        >
          {isBeingRestored
            ? <ActivityIndicator size="small" color={Colors.primary} />
            : (
              <>
                <Ionicons name="refresh" size={14} color={Colors.primary} />
                <Text style={styles.restoreBtnText}>Restaurer</Text>
              </>
            )
          }
        </Pressable>
      </View>
    );
  };

  // const total = items.length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />

      {/* Page title */}
      {/* <View style={styles.pageTitleRow}>
        <Text style={styles.pageTitle}>Corbeille</Text>
        {total > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{total}</Text>
          </View>
        )}
      </View> */}

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['notes', 'taches', 'projets'] as TabType[]).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'notes' ? 'Notes' : tab === 'taches' ? 'Tâches' : 'Projets'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        {/* Search */}
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={16} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher…"
            placeholderTextColor={Colors.textDisabled}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={Colors.textDisabled} />
            </Pressable>
          )}
        </View>

        {/* Dropdown filters row */}
        <View style={styles.dropdownRow}>
          {/* Projet dropdown (notes & taches seulement) */}
          {activeTab !== 'projets' && (
            <Pressable onPress={() => setShowProjetPicker(true)} style={styles.dropdownBtn}>
              {selectedProjet && (
                <View style={[styles.projetDot, { backgroundColor: selectedProjet.couleur }]} />
              )}
              {!selectedProjet && <Ionicons name="folder-outline" size={13} color={Colors.textSecondary} />}
              <Text style={styles.dropdownBtnText} numberOfLines={1}>
                {selectedProjet ? selectedProjet.titre : 'Projet'}
              </Text>
              <Ionicons name="chevron-down" size={12} color={Colors.textSecondary} />
            </Pressable>
          )}

          {/* Date dropdown */}
          <Pressable onPress={() => setShowDatePicker(true)} style={styles.dropdownBtn}>
            <Ionicons name="calendar-outline" size={13} color={Colors.textSecondary} />
            <Text style={styles.dropdownBtnText}>{DATE_FILTER_LABELS[dateFilter]}</Text>
            <Ionicons name="chevron-down" size={12} color={Colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Error state */}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* List */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : items.length === 0 && !error ? (
        <ScrollView
          contentContainerStyle={styles.center}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={() => load(true)} tintColor={Colors.primary} />
          }
        >
          <Ionicons name="trash-outline" size={40} color={Colors.textDisabled} />
          <Text style={styles.emptyText}>Aucun élément supprimé</Text>
        </ScrollView>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={() => load(true)} tintColor={Colors.primary} />
          }
        />
      )}

      {/* Projet picker modal */}
      <Modal visible={showProjetPicker} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowProjetPicker(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Filtrer par projet</Text>
          <ScrollView>
            <Pressable
              onPress={() => { setSelectedProjetId(null); setShowProjetPicker(false); }}
              style={[styles.pickerOption, !selectedProjetId && styles.pickerOptionSelected]}
            >
              <Ionicons name="albums-outline" size={18} color={Colors.textSecondary} />
              <Text style={styles.pickerOptionText}>Tous les projets</Text>
              {!selectedProjetId && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
            </Pressable>
            {projets.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => { setSelectedProjetId(p.id); setShowProjetPicker(false); }}
                style={[styles.pickerOption, selectedProjetId === p.id && styles.pickerOptionSelected]}
              >
                <View style={[styles.projetDot, { backgroundColor: p.couleur, width: 10, height: 10, borderRadius: 5 }]} />
                <Text style={styles.pickerOptionText}>{p.titre}</Text>
                {selectedProjetId === p.id && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Date filter modal */}
      <Modal visible={showDatePicker} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowDatePicker(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Filtrer par date</Text>
          {(['all', 'today', 'week', 'month'] as DateFilter[]).map((key) => (
            <Pressable
              key={key}
              onPress={() => { setDateFilter(key); setShowDatePicker(false); }}
              style={[styles.pickerOption, dateFilter === key && styles.pickerOptionSelected]}
            >
              <Ionicons
                name={key === 'all' ? 'time-outline' : 'calendar-outline'}
                size={18}
                color={dateFilter === key ? Colors.primary : Colors.textSecondary}
              />
              <Text style={[styles.pickerOptionText, dateFilter === key && { color: Colors.primary, fontWeight: '600' }]}>
                {DATE_FILTER_LABELS[key]}
              </Text>
              {dateFilter === key && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
            </Pressable>
          ))}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 14, color: Colors.textDisabled, fontStyle: 'italic' },

  pageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: 4,
    paddingBottom: 10,
  },
  pageTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  countBadge: {
    backgroundColor: Colors.error + '20',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countBadgeText: { fontSize: 12, fontWeight: '600', color: Colors.error },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: Layout.screenPaddingH,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: 14, fontWeight: '500', color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary, fontWeight: '600' },

  // Filters
  filters: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.textPrimary },
  dropdownRow: { flexDirection: 'row', gap: 8 },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    maxWidth: 160,
  },
  dropdownBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
    flexShrink: 1,
  },

  // Error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: Layout.screenPaddingH,
    padding: 12,
    borderRadius: 10,
    backgroundColor: Colors.error + '12',
    borderWidth: 1,
    borderColor: Colors.error + '30',
  },
  errorText: { flex: 1, fontSize: 13, color: Colors.error, lineHeight: 18 },

  // List
  list: { padding: Layout.screenPaddingH, gap: 10 },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.cardRadius,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardBody: { flex: 1, gap: 4 },
  projetTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  projetDot: { width: 7, height: 7, borderRadius: 3.5 },
  projetTagText: { fontSize: 11, fontWeight: '600' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, lineHeight: 20 },
  cascadeText: { fontSize: 12, color: Colors.textSecondary },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  deletedAtText: { fontSize: 11, color: Colors.textDisabled },
  deletedByRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deletedByText: { fontSize: 11, color: Colors.textDisabled, fontStyle: 'italic' },

  // Restore button
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.primary + '12',
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    minWidth: 90,
    justifyContent: 'center',
  },
  restoreBtnDisabled: { opacity: 0.5 },
  restoreBtnText: { fontSize: 13, fontWeight: '600', color: Colors.primary },

  // Modal
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
    paddingHorizontal: Layout.screenPaddingH,
    paddingBottom: 8,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Layout.screenPaddingH,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  pickerOptionSelected: { backgroundColor: Colors.surfaceAlt },
  pickerOptionText: { flex: 1, fontSize: 15, color: Colors.textPrimary },
});
