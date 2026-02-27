import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/src/api/client';
import { Colors } from '@/src/constants/colors';
import { Layout } from '@/src/constants/layout';
import { useAuth } from '@/src/contexts/AuthContext';
import { useSync } from '@/src/contexts/SyncContext';
import {
  createCommentaire,
  deleteCommentaire,
  getCommentairesByTache,
  upsertCommentaireFromServer,
  type Commentaire,
} from '@/src/db/commentaires';
import { softDeleteTache, getTacheById, updateTache, PRIORITES, type Tache, type Priorite } from '@/src/db/taches';
import {
  getLiaisonsByTache,
  createLiaison,
  deleteLiaison,
  type LinkedItem,
} from '@/src/db/liaisons';
import { useProjets } from '@/src/hooks/useProjets';
import { pushCommentaire, pushTache, pushLiaison } from '@/src/services/sync';
import { createNotification } from '@/src/db/notifications';
import { sendLocalNotification } from '@/src/services/pushNotifications';

// ─── Config ──────────────────────────────────────────────────────────────────

const STATUTS: { key: Tache['statut']; label: string; color: string }[] = [
  { key: 'todo',     label: 'À faire',  color: Colors.todo },
  { key: 'en_cours', label: 'En cours', color: Colors.en_cours },
  { key: 'done',     label: 'Terminé',  color: Colors.done },
];

function statutColor(s: string) { return STATUTS.find((x) => x.key === s)?.color ?? Colors.textSecondary; }
function statutLabel(s: string) { return STATUTS.find((x) => x.key === s)?.label ?? s; }

function normDate(s: string) {
  return s.includes('T') ? s : s.replace(' ', 'T') + 'Z';
}

function formatDate(iso: string) {
  return new Date(normDate(iso)).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatShortDate(iso: string) {
  return new Date(normDate(iso)).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

interface Membre { id: number; nom: string; prenom: string | null; }
function membreLabel(m: Membre) { return m.prenom ? `${m.prenom} ${m.nom}` : m.nom; }

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function TacheDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useSQLiteContext();
  const { team, user } = useAuth();
  const { bumpSyncVersion } = useSync();
  const { projets } = useProjets();

  const [tache, setTache] = useState<Tache | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  // Edit state
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProjetId, setSelectedProjetId] = useState<number | null>(null);
  const [statut, setStatut] = useState<Tache['statut']>('todo');
  const [priorite, setPriorite] = useState<Priorite | null>(null);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [assigneId, setAssigneId] = useState<number | null>(null);
  const [membres, setMembres] = useState<Membre[]>([]);

  const [showProjetPicker, setShowProjetPicker] = useState(false);
  const [showAssignePicker, setShowAssignePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerStep, setPickerStep] = useState<'date' | 'time'>('date');
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [isSaving, setIsSaving] = useState(false);

  // Comments state
  const [commentaires, setCommentaires] = useState<Commentaire[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(0);

  // Liaisons state
  const [liaisons, setLiaisons] = useState<LinkedItem[]>([]);
  const [showLiaisonModal, setShowLiaisonModal] = useState(false);
  const [modalStep, setModalStep] = useState<'projet' | 'type' | 'items'>('projet');
  const [modalProjetId, setModalProjetId] = useState<number | null>(null);
  const [modalType, setModalType] = useState<'note' | 'tache'>('note');
  const [modalItems, setModalItems] = useState<{ id: number; titre: string; statut: string }[]>([]);
  const [modalSearch, setModalSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isLoadingModalItems, setIsLoadingModalItems] = useState(false);
  const [isAddingLiaisons, setIsAddingLiaisons] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const row = await getTacheById(db, Number(id));
      setTache(row);
      if (row) {
        setTitre(row.titre);
        setDescription(row.description ?? '');
        setSelectedProjetId(row.projet_id);
        setStatut(row.statut);
        setPriorite(row.priorite ?? null);
        setDueDate(row.due_date ? new Date(normDate(row.due_date)) : null);
        setAssigneId(row.assigne_id);
      }
    } finally {
      setIsLoading(false);
    }
  }, [db, id]);

  useEffect(() => { load(); }, [load]);

  // Load team members
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

  const loadCommentaires = useCallback(async (currentTache: Tache) => {
    if (!team) return;
    setIsLoadingComments(true);
    try {
      if (currentTache.server_id) {
        const res = await api.get<any>(`/taches/${currentTache.server_id}/commentaires`);
        const list: any[] = Array.isArray(res?.list) ? res.list
          : Array.isArray(res?.list?.data) ? res.list.data
          : [];

        const teamRow = await db.getFirstAsync<{ id: number }>(
          'SELECT id FROM teams WHERE server_id = ?', team.id,
        );
        if (teamRow) {
          const mentionTag = user
            ? `@${user.prenom ? `${user.prenom} ${user.nom}` : user.nom}`.toLowerCase()
            : null;

          for (const c of list) {
            const auteurRow = await db.getFirstAsync<{ id: number }>(
              'SELECT id FROM users WHERE server_id = ?', c.auteur_id ?? c.auteur?.id,
            );
            await upsertCommentaireFromServer(
              db, c,
              auteurRow?.id ?? currentTache.auteur_id,
              teamRow.id,
              undefined,
              currentTache.id,
            );

            // Mention notification
            if (
              mentionTag &&
              c.contenu.toLowerCase().includes(mentionTag) &&
              (c.auteur_id ?? c.auteur?.id) !== user?.id
            ) {
              const mentionCorps = `Dans la tâche "${currentTache.titre}"`;
              createNotification(db, {
                ref_id: `mention_commentaire_${c.id}`,
                type: 'mention',
                titre: 'Vous avez été mentionné',
                corps: mentionCorps,
                entity_type: 'tache',
                entity_id: currentTache.id,
              }).then(() =>
                sendLocalNotification('Vous avez été mentionné', mentionCorps, {
                  entity_type: 'tache',
                  entity_id: currentTache.id,
                }),
              ).catch(() => {});
            }
          }
        }
      }
    } catch (e) {
      console.warn('[Commentaires] Fetch tache commentaires échoué:', e);
    } finally {
      setIsLoadingComments(false);
    }
    const rows = await getCommentairesByTache(db, Number(id));
    setCommentaires(rows);
  }, [db, team, id, user?.id]);

  useEffect(() => {
    if (tache && !editMode) {
      loadCommentaires(tache);
    }
  }, [tache, editMode]);

  const reloadCommentairesLocal = useCallback(async () => {
    const rows = await getCommentairesByTache(db, Number(id));
    setCommentaires(rows);
  }, [db, id]);

  const selectedProjet = projets.find((p) => p.id === selectedProjetId);
  const selectedAssigne = membres.find((m) => m.id === assigneId);

  // ─── Liaisons ────────────────────────────────────────────────────────────

  const loadLiaisons = useCallback(async () => {
    if (!tache) return;
    const rows = await getLiaisonsByTache(db, tache.id);
    setLiaisons(rows);
  }, [db, tache]);

  useEffect(() => { if (tache) loadLiaisons(); }, [tache]);

  const navigateToLinked = useCallback((item: LinkedItem) => {
    if (item.type === 'note') {
      router.push(`/(app)/note/${item.id}` as any);
    } else {
      router.push(`/(app)/tache/${item.id}` as any);
    }
  }, [router]);

  const handleDeleteLiaison = useCallback((item: LinkedItem) => {
    Alert.alert('Supprimer la liaison', `Retirer le lien vers "${item.titre}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          if (item.liaison_server_id) {
            api.delete(`/liaisons/${item.liaison_server_id}`).catch(() => {});
          }
          await deleteLiaison(db, item.liaison_id);
          await loadLiaisons();
        },
      },
    ]);
  }, [db, loadLiaisons]);

  const handleOpenLiaisonModal = useCallback(() => {
    setModalStep('projet');
    setModalProjetId(null);
    setModalType('note');
    setModalItems([]);
    setModalSearch('');
    setSelectedIds(new Set());
    setShowLiaisonModal(true);
  }, []);

  const handleModalBack = useCallback(() => {
    if (modalStep === 'items') {
      setModalStep('type');
      setModalItems([]);
      setModalSearch('');
      setSelectedIds(new Set());
    } else if (modalStep === 'type') {
      setModalStep('projet');
      setModalProjetId(null);
    }
  }, [modalStep]);

  const loadModalItems = useCallback(async (type: 'note' | 'tache', projetId: number) => {
    setIsLoadingModalItems(true);
    const alreadyLinkedIds = liaisons.filter((l) => l.type === type).map((l) => l.id);
    try {
      if (type === 'note') {
        const rows = await db.getAllAsync<{ id: number; titre: string; statut: string }>(
          'SELECT id, titre, statut FROM notes WHERE projet_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC',
          projetId,
        );
        setModalItems(rows.filter((r) => !alreadyLinkedIds.includes(r.id)));
      } else {
        const rows = await db.getAllAsync<{ id: number; titre: string; statut: string }>(
          'SELECT id, titre, statut FROM taches WHERE projet_id = ? AND deleted_at IS NULL ORDER BY created_at DESC',
          projetId,
        );
        setModalItems(rows.filter((r) => r.id !== tache?.id && !alreadyLinkedIds.includes(r.id)));
      }
    } finally {
      setIsLoadingModalItems(false);
    }
  }, [db, tache, liaisons]);

  const toggleSelected = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleConfirmLiaisons = useCallback(async () => {
    if (!tache || !team || selectedIds.size === 0) return;
    setIsAddingLiaisons(true);
    try {
      const teamRow = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM teams WHERE server_id = ?', team.id,
      );
      if (!teamRow) return;
      for (const targetId of selectedIds) {
        const liaison = await createLiaison(db, {
          source_type: 'tache',
          source_id: tache.id,
          target_type: modalType,
          target_id: targetId,
          team_id: teamRow.id,
        });
        pushLiaison(db, liaison.id, team.id);
      }
      setShowLiaisonModal(false);
      await loadLiaisons();
    } finally {
      setIsAddingLiaisons(false);
    }
  }, [tache, team, db, selectedIds, modalType, loadLiaisons]);

  const filteredModalItems = useMemo(() => {
    const q = modalSearch.toLowerCase().trim();
    if (!q) return modalItems;
    return modalItems.filter((item) => item.titre.toLowerCase().includes(q));
  }, [modalItems, modalSearch]);

  // ─── Date picker ────────────────────────────────────────────────────────────

  const openDatePicker = () => {
    setTempDate(dueDate ?? new Date());
    setPickerStep('date');
    setShowDatePicker(true);
  };

  const onAndroidPickerChange = useCallback((event: DateTimePickerEvent, selected?: Date) => {
    setShowDatePicker(false);
    if (event.type === 'dismissed' || !selected) return;
    if (pickerStep === 'date') {
      const d = dueDate ? new Date(dueDate) : new Date();
      d.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      setTempDate(d);
      setPickerStep('time');
      setShowDatePicker(true);
    } else {
      const result = new Date(tempDate);
      result.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      setDueDate(result);
    }
  }, [dueDate, pickerStep, tempDate]);

  // ─── Actions ─────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!tache || !titre.trim() || !selectedProjetId || !team) return;
    setIsSaving(true);
    try {
      await updateTache(db, tache.id, {
        titre: titre.trim(),
        description: description.trim() || null,
        statut,
        priorite,
        projet_id: selectedProjetId,
        assigne_id: assigneId,
        due_date: dueDate ? dueDate.toISOString() : null,
      });
      pushTache(db, tache.id, team.id);
      await load();
      setEditMode(false);
    } finally {
      setIsSaving(false);
    }
  }, [tache, titre, description, selectedProjetId, statut, priorite, assigneId, dueDate, team, db, load]);

  const handleStatusChange = useCallback(async (newStatut: Tache['statut']) => {
    if (!tache || !team) return;
    await updateTache(db, tache.id, { statut: newStatut });
    pushTache(db, tache.id, team.id);
    await load();
  }, [tache, team, db, load]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Supprimer la tâche',
      'Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer', style: 'destructive',
          onPress: async () => {
            if (!tache) return;
            if (tache.server_id) {
              api.delete(`/taches/${tache.server_id}`).catch((e) => {
                console.warn('[Delete] Tache', tache.server_id, 'échoué:', e);
              });
            }
            const localUser = user
              ? await db.getFirstAsync<{ id: number }>('SELECT id FROM users WHERE server_id = ?', user.id)
              : null;
            await softDeleteTache(db, tache.id, localUser?.id ?? 0);
            bumpSyncVersion();
            router.back();
          },
        },
      ],
    );
  }, [tache, db, router]);

  const handleCancelEdit = useCallback(() => {
    if (tache) {
      setTitre(tache.titre);
      setDescription(tache.description ?? '');
      setSelectedProjetId(tache.projet_id);
      setStatut(tache.statut);
      setPriorite(tache.priorite ?? null);
      setDueDate(tache.due_date ? new Date(normDate(tache.due_date)) : null);
      setAssigneId(tache.assigne_id);
    }
    setEditMode(false);
  }, [tache]);

  const filteredMentions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return membres.filter((m) => membreLabel(m).toLowerCase().includes(q));
  }, [membres, mentionQuery]);

  const handleCommentChange = useCallback((text: string) => {
    setCommentInput(text);
    const lastAt = text.lastIndexOf('@');
    if (lastAt >= 0) {
      const afterAt = text.slice(lastAt + 1);
      if (!afterAt.includes(' ') && !afterAt.includes('\n')) {
        setMentionQuery(afterAt);
        setMentionStart(lastAt);
        return;
      }
    }
    setMentionQuery(null);
  }, []);

  const selectMention = useCallback((membre: Membre) => {
    const label = membreLabel(membre);
    const before = commentInput.slice(0, mentionStart);
    const after = commentInput.slice(mentionStart + 1 + (mentionQuery?.length ?? 0));
    setCommentInput(`${before}@${label} ${after}`);
    setMentionQuery(null);
  }, [commentInput, mentionStart, mentionQuery]);

  const handleSendComment = useCallback(async () => {
    const text = commentInput.trim();
    if (!text || !tache || !team || !user || isSendingComment) return;
    setIsSendingComment(true);
    try {
      const auteurRow = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM users WHERE server_id = ?', user.id,
      );
      const teamRow = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM teams WHERE server_id = ?', team.id,
      );
      if (!auteurRow || !teamRow) return;

      const newComment = await createCommentaire(db, {
        contenu: text,
        tache_id: tache.id,
        auteur_id: auteurRow.id,
        team_id: teamRow.id,
      });
      setCommentInput('');
      await reloadCommentairesLocal();
      pushCommentaire(db, newComment.id);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } finally {
      setIsSendingComment(false);
    }
  }, [commentInput, tache, team, user, db, isSendingComment, reloadCommentairesLocal]);

  const handleDeleteComment = useCallback((c: Commentaire) => {
    Alert.alert(
      'Supprimer le commentaire',
      'Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer', style: 'destructive',
          onPress: async () => {
            if (c.server_id) {
              api.delete(`/commentaires/${c.server_id}`).catch((e) => {
                console.warn('[Delete] Commentaire', c.server_id, 'échoué:', e);
              });
            }
            await deleteCommentaire(db, c.id);
            await reloadCommentairesLocal();
          },
        },
      ],
    );
  }, [db, reloadCommentairesLocal]);

  // ─── Loading / not found ──────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!tache) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.notFoundText}>Tâche introuvable.</Text>
          <Pressable onPress={() => router.back()} style={styles.backLink}>
            <Text style={styles.backLinkText}>Retour</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isPending = tache.sync_status === 'pending';
  const canSave = titre.trim().length > 0 && selectedProjetId !== null;
  const isOverdue = tache.due_date && tache.statut !== 'done' && new Date(normDate(tache.due_date)) < new Date();

  // Shared pickers (used in both modes)
  const pickerModals = (
    <>
      {/* Android date picker */}
      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={tempDate}
          mode={pickerStep}
          display="default"
          onChange={onAndroidPickerChange}
        />
      )}

      {/* iOS date picker */}
      {Platform.OS === 'ios' && (
        <Modal visible={showDatePicker} transparent animationType="slide">
          <Pressable style={styles.modalOverlay} onPress={() => setShowDatePicker(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.iosPickerHeader}>
              <Pressable onPress={() => setShowDatePicker(false)}>
                <Text style={styles.iosPickerCancel}>Annuler</Text>
              </Pressable>
              <Pressable onPress={() => { setDueDate(new Date(tempDate)); setShowDatePicker(false); }}>
                <Text style={styles.iosPickerDone}>Confirmer</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={tempDate}
              mode="datetime"
              display="spinner"
              locale="fr-FR"
              onChange={(_, d) => { if (d) setTempDate(d); }}
            />
          </View>
        </Modal>
      )}

      {/* Projet picker */}
      <Modal visible={showProjetPicker} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowProjetPicker(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Choisir un projet</Text>
          <FlatList
            data={projets}
            keyExtractor={(p) => String(p.id)}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => { setSelectedProjetId(item.id); setShowProjetPicker(false); }}
                style={[styles.pickerOption, selectedProjetId === item.id && styles.pickerOptionSelected]}
              >
                <View style={[styles.pickerOptionDot, { backgroundColor: item.couleur }]} />
                <Text style={styles.pickerOptionText}>{item.titre}</Text>
                {selectedProjetId === item.id && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
              </Pressable>
            )}
          />
        </View>
      </Modal>

      {/* Assigné picker */}
      <Modal visible={showAssignePicker} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowAssignePicker(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Assigner à</Text>
          <FlatList
            data={[{ id: -1, nom: 'Personne', prenom: null } as Membre, ...membres]}
            keyExtractor={(m) => String(m.id)}
            renderItem={({ item }) => {
              const isNone = item.id === -1;
              const isSelected = isNone ? assigneId === null : assigneId === item.id;
              return (
                <Pressable
                  onPress={() => { setAssigneId(isNone ? null : item.id); setShowAssignePicker(false); }}
                  style={[styles.pickerOption, isSelected && styles.pickerOptionSelected]}
                >
                  <Ionicons
                    name={isNone ? 'person-outline' : 'person-circle-outline'}
                    size={20}
                    color={isNone ? Colors.textDisabled : Colors.primary}
                  />
                  <Text style={[styles.pickerOptionText, isNone && { color: Colors.textDisabled }]}>
                    {isNone ? 'Personne' : membreLabel(item)}
                  </Text>
                  {isSelected && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );

  // ─── Edit mode ─────────────────────────────────────────────────────────────

  if (editMode) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={handleCancelEdit} style={styles.headerBtn}>
            <Ionicons name="close" size={22} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Modifier la tâche</Text>
          <Pressable
            onPress={handleSave}
            disabled={!canSave || isSaving}
            style={[styles.saveBtn, (!canSave || isSaving) && styles.saveBtnDisabled]}
          >
            {isSaving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.saveBtnText}>Enregistrer</Text>
            }
          </Pressable>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">

            {/* Projet */}
            <Pressable onPress={() => setShowProjetPicker(true)} style={styles.selectorRow}>
              <View style={[styles.selectorDot, { backgroundColor: selectedProjet?.couleur ?? Colors.border }]} />
              <Text style={[styles.selectorText, !selectedProjet && { color: Colors.textDisabled }]}>
                {selectedProjet ? selectedProjet.titre : 'Projet…'}
              </Text>
              <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} />
            </Pressable>

            {/* Statut */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Statut</Text>
              <View style={styles.chipRow}>
                {STATUTS.map((s) => (
                  <Pressable
                    key={s.key}
                    onPress={() => setStatut(s.key)}
                    style={[styles.chip, statut === s.key && { backgroundColor: s.color + '20', borderColor: s.color }]}
                  >
                    <View style={[styles.chipDot, { backgroundColor: s.color }]} />
                    <Text style={[styles.chipText, statut === s.key && { color: s.color }]}>{s.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Priorité */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Priorité</Text>
              <View style={styles.chipRow}>
                {PRIORITES.map((p) => {
                  const active = priorite === p.key;
                  return (
                    <Pressable
                      key={p.key}
                      onPress={() => setPriorite(active ? null : p.key)}
                      style={[styles.chip, active && { backgroundColor: p.color + '20', borderColor: p.color }]}
                    >
                      <View style={[styles.chipDot, { backgroundColor: p.color }]} />
                      <Text style={[styles.chipText, active && { color: p.color }]}>{p.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Titre */}
            <TextInput
              style={styles.titleInput}
              placeholder="Titre de la tâche"
              placeholderTextColor={Colors.textDisabled}
              value={titre}
              onChangeText={setTitre}
              multiline
              maxLength={200}
            />

            <View style={styles.divider} />

            {/* Description */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Description</Text>
              <TextInput
                style={styles.descInput}
                placeholder="Décrivez la tâche…"
                placeholderTextColor={Colors.textDisabled}
                value={description}
                onChangeText={setDescription}
                multiline
                textAlignVertical="top"
              />
            </View>

            {/* Assigné */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Assigné à</Text>
              <Pressable onPress={() => setShowAssignePicker(true)} style={styles.fieldRow}>
                <Ionicons name="person-circle-outline" size={18} color={Colors.textSecondary} />
                <Text style={[styles.selectorText, !selectedAssigne && { color: Colors.textDisabled }]}>
                  {selectedAssigne ? membreLabel(selectedAssigne) : 'Personne…'}
                </Text>
                <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} />
              </Pressable>
            </View>

            {/* Date d'échéance */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Date d&apos;échéance</Text>
              <Pressable onPress={openDatePicker} style={styles.fieldRow}>
                <Ionicons name="calendar-outline" size={18} color={dueDate ? Colors.primary : Colors.textSecondary} />
                <Text style={[styles.selectorText, !dueDate && { color: Colors.textDisabled }]}>
                  {dueDate ? formatDate(dueDate.toISOString()) : 'Choisir une date et heure…'}
                </Text>
                {dueDate && (
                  <Pressable onPress={() => setDueDate(null)} hitSlop={8}>
                    <Ionicons name="close-circle" size={16} color={Colors.textSecondary} />
                  </Pressable>
                )}
              </Pressable>
            </View>

            <View style={{ height: 60 }} />
          </ScrollView>
        </KeyboardAvoidingView>

        {pickerModals}
      </SafeAreaView>
    );
  }

  // ─── View mode ─────────────────────────────────────────────────────────────

  const assigneLabel = tache.assigne_prenom
    ? `${tache.assigne_prenom} ${tache.assigne_nom}`
    : tache.assigne_nom ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={handleDelete} style={[styles.headerBtn, { marginRight: 4 }]}>
          <Ionicons name="trash-outline" size={20} color={Colors.error} />
        </Pressable>
        <Pressable onPress={() => setEditMode(true)} style={styles.saveBtn}>
          <Text style={styles.saveBtnText}>Modifier</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Projet + badges */}
          <View style={styles.noteMeta}>
            {tache.projet_titre && (
              <View style={[styles.projetTag, { backgroundColor: (tache.projet_couleur ?? Colors.primary) + '18' }]}>
                <View style={[styles.projetDot, { backgroundColor: tache.projet_couleur ?? Colors.primary }]} />
                <Text style={[styles.projetTagText, { color: tache.projet_couleur ?? Colors.primary }]}>
                  {tache.projet_titre}
                </Text>
              </View>
            )}
            {isPending && (
              <View style={styles.pendingBadge}>
                <Ionicons name="cloud-upload-outline" size={12} color={Colors.textDisabled} />
                <Text style={styles.pendingText}>Non synchronisé</Text>
              </View>
            )}
          </View>

          {/* Titre */}
          <Text style={styles.noteTitle}>{tache.titre}</Text>

          {/* Statut rapide */}
          <Text style={styles.sectionLabel}>Statut</Text>
          <View style={styles.chipRow}>
            {STATUTS.map((s) => (
              <Pressable
                key={s.key}
                onPress={() => handleStatusChange(s.key)}
                style={[styles.chip, tache.statut === s.key && { backgroundColor: s.color + '20', borderColor: s.color }]}
              >
                <View style={[styles.chipDot, { backgroundColor: s.color }]} />
                <Text style={[styles.chipText, tache.statut === s.key && { color: s.color }]}>{s.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={[styles.divider, { marginTop: 16 }]} />

          {/* Infos */}
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={15} color={Colors.textSecondary} />
            <Text style={styles.infoLabel}>Auteur</Text>
            <Text style={styles.infoValue}>
              {tache.auteur_prenom ? `${tache.auteur_prenom} ${tache.auteur_nom}` : tache.auteur_nom ?? '—'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="person-circle-outline" size={15} color={Colors.textSecondary} />
            <Text style={styles.infoLabel}>Assigné à</Text>
            <Text style={styles.infoValue}>{assigneLabel ?? '—'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons
              name="calendar-outline"
              size={15}
              color={isOverdue ? Colors.error : Colors.textSecondary}
            />
            <Text style={styles.infoLabel}>Échéance</Text>
            <Text style={[styles.infoValue, isOverdue && { color: Colors.error }]}>
              {tache.due_date
                ? `${formatDate(tache.due_date)}${isOverdue ? '  (En retard)' : ''}`
                : '—'}
            </Text>
          </View>

          {(() => {
            const p = tache.priorite ? PRIORITES.find((x) => x.key === tache.priorite) : null;
            return p ? (
              <View style={styles.infoRow}>
                <Ionicons name="flag-outline" size={15} color={p.color} />
                <Text style={styles.infoLabel}>Priorité</Text>
                <View style={[styles.prioriteInlineTag, { backgroundColor: p.color + '20' }]}>
                  <Text style={[styles.prioriteInlineText, { color: p.color }]}>{p.label}</Text>
                </View>
              </View>
            ) : null;
          })()}

          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={15} color={Colors.textSecondary} />
            <Text style={styles.infoLabel}>Modifié</Text>
            <Text style={styles.infoValue}>{formatDate(tache.updated_at)}</Text>
          </View>

          {/* Description */}
          {tache.description ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.descText} selectable>{tache.description}</Text>
            </>
          ) : null}

          {/* ── Liaisons ──────────────────────────────────────────────── */}
          <View style={styles.liaisonSection}>
            <View style={styles.liaisonSectionHeader}>
              <Ionicons name="link-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.liaisonSectionTitle}>
                Liaisons{liaisons.length > 0 ? ` (${liaisons.length})` : ''}
              </Text>
              <Pressable onPress={handleOpenLiaisonModal} hitSlop={8}>
                <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
              </Pressable>
            </View>

            {liaisons.length === 0 && (
              <Text style={styles.noLiaisons}>Aucune liaison.</Text>
            )}

            {liaisons.map((item) => (
              <Pressable
                key={item.liaison_id}
                onPress={() => navigateToLinked(item)}
                onLongPress={() => handleDeleteLiaison(item)}
                style={styles.liaisonItem}
              >
                <View style={[
                  styles.liaisonTypeBadge,
                  { backgroundColor: item.type === 'note' ? Colors.info + '20' : Colors.en_cours + '20' },
                ]}>
                  <Ionicons
                    name={item.type === 'note' ? 'document-text-outline' : 'checkmark-circle-outline'}
                    size={11}
                    color={item.type === 'note' ? Colors.info : Colors.en_cours}
                  />
                  <Text style={[styles.liaisonTypeText, { color: item.type === 'note' ? Colors.info : Colors.en_cours }]}>
                    {item.type === 'note' ? 'Note' : 'Tâche'}
                  </Text>
                </View>
                <View style={styles.liaisonItemBody}>
                  <Text style={styles.liaisonItemTitle} numberOfLines={1}>{item.titre}</Text>
                  {item.projet_titre && (
                    <Text style={styles.liaisonItemProjet} numberOfLines={1}>{item.projet_titre}</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={14} color={Colors.textDisabled} />
              </Pressable>
            ))}
          </View>

          {/* ── Commentaires ──────────────────────────────────────────────── */}
          <View style={styles.commentSection}>
            <View style={styles.commentSectionHeader}>
              <Ionicons name="chatbubble-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.commentSectionTitle}>
                Commentaires {commentaires.length > 0 ? `(${commentaires.length})` : ''}
              </Text>
              {isLoadingComments && <ActivityIndicator size="small" color={Colors.textDisabled} />}
            </View>

            {commentaires.length === 0 && !isLoadingComments && (
              <Text style={styles.noComments}>Aucun commentaire.</Text>
            )}

            {commentaires.map((c) => {
              const auteurLabel = c.auteur_prenom
                ? `${c.auteur_prenom} ${c.auteur_nom}`
                : c.auteur_nom ?? 'Inconnu';
              return (
                <CommentItem
                  key={c.id}
                  commentaire={c}
                  auteurLabel={auteurLabel}
                  currentUserId={user?.id ?? null}
                  db={db}
                  onDelete={() => handleDeleteComment(c)}
                />
              );
            })}

            <View style={{ height: 16 }} />
          </View>
        </ScrollView>

        {/* Mention picker */}
        {mentionQuery !== null && filteredMentions.length > 0 && (
          <View style={styles.mentionPicker}>
            <ScrollView
              keyboardShouldPersistTaps="always"
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {filteredMentions.map((m) => (
                <Pressable key={m.id} onPress={() => selectMention(m)} style={styles.mentionOption}>
                  <View style={styles.mentionAvatar}>
                    <Text style={styles.mentionAvatarText}>{membreLabel(m).charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.mentionName}>{membreLabel(m)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Barre de saisie fixe */}
        <View style={styles.commentInputBar}>
          <TextInput
            style={styles.commentTextInput}
            placeholder="Ajouter un commentaire… (@nom pour mentionner)"
            placeholderTextColor={Colors.textDisabled}
            value={commentInput}
            onChangeText={handleCommentChange}
            multiline
            maxLength={1000}
          />
          <Pressable
            onPress={handleSendComment}
            disabled={!commentInput.trim() || isSendingComment}
            style={[styles.sendBtn, (!commentInput.trim() || isSendingComment) && styles.sendBtnDisabled]}
          >
            {isSendingComment
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={16} color="#fff" />
            }
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {pickerModals}

      {/* ── Modal Liaisons ──────────────────────────────────────────── */}
      <Modal visible={showLiaisonModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowLiaisonModal(false)} />
        <View style={[styles.modalSheet, styles.liaisonModalSheet]}>
          <View style={styles.modalHandle} />

          {/* Header */}
          <View style={styles.liaisonModalHeaderRow}>
            {modalStep !== 'projet' && (
              <Pressable onPress={handleModalBack} style={styles.headerBtn}>
                <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
              </Pressable>
            )}
            <Text style={[styles.modalTitle, { flex: 1 }]}>
              {modalStep === 'projet' ? 'Choisir un projet'
                : modalStep === 'type' ? 'Type d\'élément'
                : modalType === 'note' ? 'Sélectionner des notes' : 'Sélectionner des tâches'}
            </Text>
          </View>

          {/* Step 1 — Projet */}
          {modalStep === 'projet' && (
            <FlatList
              data={projets}
              keyExtractor={(p) => String(p.id)}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => { setModalProjetId(item.id); setModalStep('type'); }}
                  style={styles.pickerOption}
                >
                  <View style={[styles.pickerOptionDot, { backgroundColor: item.couleur }]} />
                  <Text style={styles.pickerOptionText}>{item.titre}</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textDisabled} />
                </Pressable>
              )}
            />
          )}

          {/* Step 2 — Type */}
          {modalStep === 'type' && (
            <View style={styles.typeStep}>
              {(['note', 'tache'] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => {
                    setModalType(t);
                    if (modalProjetId !== null) loadModalItems(t, modalProjetId);
                    setModalStep('items');
                  }}
                  style={styles.typeOption}
                >
                  <Ionicons
                    name={t === 'note' ? 'document-text-outline' : 'checkmark-circle-outline'}
                    size={32}
                    color={Colors.primary}
                  />
                  <Text style={styles.typeOptionLabel}>{t === 'note' ? 'Notes' : 'Tâches'}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Step 3 — Items */}
          {modalStep === 'items' && (
            <>
              <View style={styles.modalSearchRow}>
                <Ionicons name="search-outline" size={16} color={Colors.textSecondary} />
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="Rechercher…"
                  placeholderTextColor={Colors.textDisabled}
                  value={modalSearch}
                  onChangeText={setModalSearch}
                  autoFocus
                />
                {modalSearch.length > 0 && (
                  <Pressable onPress={() => setModalSearch('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={16} color={Colors.textDisabled} />
                  </Pressable>
                )}
              </View>

              {isLoadingModalItems ? (
                <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
              ) : filteredModalItems.length === 0 ? (
                <View style={styles.center}>
                  <Text style={styles.noLiaisons}>Aucun élément disponible.</Text>
                </View>
              ) : (
                <FlatList
                  data={filteredModalItems}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={({ item }) => {
                    const isSelected = selectedIds.has(item.id);
                    return (
                      <Pressable
                        onPress={() => toggleSelected(item.id)}
                        style={[styles.pickerOption, isSelected && styles.pickerOptionSelected]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.pickerOptionText}>{item.titre}</Text>
                        </View>
                        {isSelected
                          ? <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                          : <View style={styles.uncheckedCircle} />
                        }
                      </Pressable>
                    );
                  }}
                />
              )}

              <Pressable
                onPress={handleConfirmLiaisons}
                disabled={selectedIds.size === 0 || isAddingLiaisons}
                style={[styles.confirmBtn, (selectedIds.size === 0 || isAddingLiaisons) && styles.saveBtnDisabled]}
              >
                {isAddingLiaisons
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.confirmBtnText}>
                      Lier {selectedIds.size > 0
                        ? `${selectedIds.size} élément${selectedIds.size > 1 ? 's' : ''}`
                        : 'les éléments sélectionnés'}
                    </Text>
                }
              </Pressable>
            </>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── CommentItem ─────────────────────────────────────────────────────────────

function CommentItem({
  commentaire,
  auteurLabel,
  currentUserId,
  db,
  onDelete,
}: {
  commentaire: Commentaire;
  auteurLabel: string;
  currentUserId: number | null;
  db: any;
  onDelete: () => void;
}) {
  const [isOwn, setIsOwn] = useState(false);

  useEffect(() => {
    async function check() {
      if (!currentUserId) return;
      const row = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM users WHERE server_id = ?', currentUserId,
      );
      setIsOwn(row ? row.id === commentaire.auteur_id : false);
    }
    check();
  }, [currentUserId, commentaire.auteur_id, db]);

  return (
    <View style={commentStyles.item}>
      <View style={commentStyles.avatar}>
        <Text style={commentStyles.avatarText}>{auteurLabel.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={commentStyles.bubble}>
        <View style={commentStyles.bubbleHeader}>
          <Text style={commentStyles.auteur}>{auteurLabel}</Text>
          <Text style={commentStyles.date}>{formatShortDate(commentaire.created_at)}</Text>
          {commentaire.sync_status === 'pending' && (
            <Ionicons name="cloud-upload-outline" size={11} color={Colors.textDisabled} />
          )}
        </View>
        <Text style={commentStyles.contenu}>{commentaire.contenu}</Text>
      </View>
      {isOwn && (
        <Pressable onPress={onDelete} hitSlop={8} style={commentStyles.deleteBtn}>
          <Ionicons name="trash-outline" size={16} color={Colors.error} />
        </Pressable>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  notFoundText: { fontSize: 16, color: Colors.textSecondary },
  backLink: { paddingVertical: 8 },
  backLinkText: { color: Colors.primary, fontSize: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Layout.screenPaddingH, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface, gap: 8,
  },
  headerBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  saveBtn: {
    paddingHorizontal: 16, height: 34, borderRadius: 17,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', minWidth: 90,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  body: { flex: 1, paddingHorizontal: Layout.screenPaddingH },

  noteMeta: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingTop: 20, paddingBottom: 8, flexWrap: 'wrap',
  },
  projetTag: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  projetDot: { width: 8, height: 8, borderRadius: 4 },
  projetTagText: { fontSize: 12, fontWeight: '600' },
  pendingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 20, backgroundColor: Colors.surfaceAlt,
  },
  pendingText: { fontSize: 11, color: Colors.textDisabled },
  noteTitle: {
    fontSize: 22, fontWeight: '700', color: Colors.textPrimary,
    lineHeight: 30, paddingBottom: 16,
  },

  section: { marginTop: 16, marginBottom: 4 },
  sectionLabel: {
    fontSize: 11, fontWeight: '600', color: Colors.textSecondary,
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border,
  },
  chipDot: { width: 7, height: 7, borderRadius: 3.5 },
  chipText: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },

  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 16 },

  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  infoLabel: { fontSize: 13, color: Colors.textSecondary, width: 80 },
  infoValue: { flex: 1, fontSize: 13, color: Colors.textPrimary, fontWeight: '500' },
  prioriteInlineTag: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  prioriteInlineText: { fontSize: 12, fontWeight: '600' },

  selectorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 11,
    borderRadius: 10, backgroundColor: Colors.surfaceAlt,
    borderWidth: 1, borderColor: Colors.border, marginTop: 16,
  },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 11,
    borderRadius: 10, backgroundColor: Colors.surfaceAlt,
    borderWidth: 1, borderColor: Colors.border,
  },
  selectorDot: { width: 10, height: 10, borderRadius: 5 },
  selectorText: { flex: 1, fontSize: 14, fontWeight: '500', color: Colors.textPrimary },

  titleInput: {
    fontSize: 22, fontWeight: '700', color: Colors.textPrimary,
    paddingTop: 16, paddingBottom: 12, lineHeight: 30,
  },
  descInput: {
    fontSize: 15, color: Colors.textPrimary, lineHeight: 22,
    minHeight: 120, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 16,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface, textAlignVertical: 'top',
  },
  descText: { fontSize: 15, color: Colors.textPrimary, lineHeight: 24 },

  modalOverlay: { flex: 1, backgroundColor: Colors.overlay },
  modalSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 40, maxHeight: '65%',
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border,
    alignSelf: 'center', marginTop: 12, marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16, fontWeight: '600', color: Colors.textPrimary,
    paddingHorizontal: Layout.screenPaddingH, paddingBottom: 12,
  },
  iosPickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: Layout.screenPaddingH, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  iosPickerCancel: { fontSize: 16, color: Colors.textSecondary },
  iosPickerDone: { fontSize: 16, fontWeight: '600', color: Colors.primary },
  pickerOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Layout.screenPaddingH, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  pickerOptionSelected: { backgroundColor: Colors.surfaceAlt },
  pickerOptionDot: { width: 12, height: 12, borderRadius: 6 },
  pickerOptionText: { flex: 1, fontSize: 15, color: Colors.textPrimary },

  // Liaisons section
  liaisonSection: { marginTop: 24, marginBottom: 8 },
  liaisonSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  liaisonSectionTitle: {
    fontSize: 11, fontWeight: '600', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, flex: 1,
  },
  noLiaisons: { fontSize: 14, color: Colors.textDisabled, fontStyle: 'italic', paddingVertical: 4 },
  liaisonItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: Colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.borderLight, marginBottom: 6,
  },
  liaisonTypeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
  },
  liaisonTypeText: { fontSize: 10, fontWeight: '600' },
  liaisonItemBody: { flex: 1 },
  liaisonItemTitle: { fontSize: 14, fontWeight: '500', color: Colors.textPrimary },
  liaisonItemProjet: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },

  // Liaison modal
  liaisonModalSheet: { maxHeight: '75%' },
  liaisonModalHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Layout.screenPaddingH, paddingBottom: 8, gap: 8,
  },
  typeStep: {
    flexDirection: 'row', gap: 16,
    paddingHorizontal: Layout.screenPaddingH, paddingVertical: 24,
    justifyContent: 'center',
  },
  typeOption: {
    flex: 1, alignItems: 'center', gap: 10, padding: 20,
    borderRadius: 14, backgroundColor: Colors.surfaceAlt,
    borderWidth: 1, borderColor: Colors.border,
  },
  typeOptionLabel: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  modalSearchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: Layout.screenPaddingH, marginBottom: 8,
    backgroundColor: Colors.surfaceAlt, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  modalSearchInput: { flex: 1, fontSize: 14, color: Colors.textPrimary },
  uncheckedCircle: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Colors.border,
  },
  confirmBtn: {
    marginHorizontal: Layout.screenPaddingH, marginTop: 8,
    paddingVertical: 14, borderRadius: 12,
    backgroundColor: Colors.primary, alignItems: 'center',
  },
  confirmBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },

  // Mention picker
  mentionPicker: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1, borderTopColor: Colors.border,
    maxHeight: 160,
  },
  mentionOption: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Layout.screenPaddingH, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  mentionAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  mentionAvatarText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  mentionName: { fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },

  // Comments
  commentSection: { marginTop: 24 },
  commentSectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12,
  },
  commentSectionTitle: {
    fontSize: 11, fontWeight: '600', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, flex: 1,
  },
  noComments: { fontSize: 14, color: Colors.textDisabled, fontStyle: 'italic', paddingVertical: 8 },
  commentInputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: Layout.screenPaddingH, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface,
    marginBottom: 40,

  },
  commentTextInput: {
    flex: 1, fontSize: 14, color: Colors.textPrimary,
    backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, maxHeight: 100,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});

const commentStyles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primary + '20', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  bubble: {
    flex: 1, backgroundColor: Colors.surfaceAlt, borderRadius: 12,
    padding: 10, borderWidth: 1, borderColor: Colors.borderLight,
  },
  bubbleHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  auteur: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary },
  date: { fontSize: 11, color: Colors.textDisabled, flex: 1 },
  contenu: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  deleteBtn: { paddingTop: 8 },
});
