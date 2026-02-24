import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/src/contexts/AuthContext';
import { useProjets } from '@/src/hooks/useProjets';
import { getTacheById, updateTache, deleteTache, type Tache } from '@/src/db/taches';
import { pushTache } from '@/src/services/sync';
import { api } from '@/src/api/client';
import { Colors } from '@/src/constants/colors';
import { Layout } from '@/src/constants/layout';

// ─── Config ──────────────────────────────────────────────────────────────────

const STATUTS: { key: Tache['statut']; label: string; color: string }[] = [
  { key: 'todo',     label: 'À faire',  color: Colors.todo },
  { key: 'en_cours', label: 'En cours', color: Colors.en_cours },
  { key: 'done',     label: 'Terminé',  color: Colors.done },
];

function statutColor(s: string) { return STATUTS.find((x) => x.key === s)?.color ?? Colors.textSecondary; }
function statutLabel(s: string) { return STATUTS.find((x) => x.key === s)?.label ?? s; }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
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
  const { team } = useAuth();
  const { projets } = useProjets();

  const [tache, setTache] = useState<Tache | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  // Edit state
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProjetId, setSelectedProjetId] = useState<number | null>(null);
  const [statut, setStatut] = useState<Tache['statut']>('todo');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [assigneId, setAssigneId] = useState<number | null>(null);
  const [membres, setMembres] = useState<Membre[]>([]);

  const [showProjetPicker, setShowProjetPicker] = useState(false);
  const [showAssignePicker, setShowAssignePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerStep, setPickerStep] = useState<'date' | 'time'>('date');
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [isSaving, setIsSaving] = useState(false);

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
        setDueDate(row.due_date ? new Date(row.due_date) : null);
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

  const selectedProjet = projets.find((p) => p.id === selectedProjetId);
  const selectedAssigne = membres.find((m) => m.id === assigneId);

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
  }, [tache, titre, description, selectedProjetId, statut, assigneId, dueDate, team, db, load]);

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
            await deleteTache(db, tache.id);
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
      setDueDate(tache.due_date ? new Date(tache.due_date) : null);
      setAssigneId(tache.assigne_id);
    }
    setEditMode(false);
  }, [tache]);

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
  const isOverdue = tache.due_date && tache.statut !== 'done' && new Date(tache.due_date) < new Date();

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

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
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

        <View style={{ height: 60 }} />
      </ScrollView>

      {pickerModals}
    </SafeAreaView>
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
});
