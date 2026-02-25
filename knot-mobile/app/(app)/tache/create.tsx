import { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/src/contexts/AuthContext';
import { useProjets } from '@/src/hooks/useProjets';
import { createTache } from '@/src/db/taches';
import { pushTache } from '@/src/services/sync';
import { Colors } from '@/src/constants/colors';
import { Layout } from '@/src/constants/layout';

// ─── Types ────────────────────────────────────────────────────────────────────

type Statut = 'todo' | 'en_cours' | 'done';

const STATUTS: { key: Statut; label: string; color: string }[] = [
  { key: 'todo',     label: 'À faire',  color: Colors.todo },
  { key: 'en_cours', label: 'En cours', color: Colors.en_cours },
  { key: 'done',     label: 'Terminé',  color: Colors.done },
];

interface Membre {
  id: number;
  nom: string;
  prenom: string | null;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CreateTacheScreen() {
  const router = useRouter();
  const { projetId: projetIdParam } = useLocalSearchParams<{ projetId?: string }>();
  const db = useSQLiteContext();
  const { user, team } = useAuth();
  const { projets } = useProjets();

  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProjetId, setSelectedProjetId] = useState<number | null>(null);
  const [statut, setStatut] = useState<Statut>('todo');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [assigneId, setAssigneId] = useState<number | null>(null);
  const [membres, setMembres] = useState<Membre[]>([]);

  const [showProjetPicker, setShowProjetPicker] = useState(false);
  const [showAssignePicker, setShowAssignePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerStep, setPickerStep] = useState<'date' | 'time'>('date');
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [isSaving, setIsSaving] = useState(false);

  // Sélectionne le projet passé en paramètre, sinon le premier de la liste
  useEffect(() => {
    if (projets.length > 0 && selectedProjetId === null) {
      const paramId = projetIdParam ? Number(projetIdParam) : null;
      const match = paramId ? projets.find((p) => p.id === paramId) : null;
      setSelectedProjetId(match?.id ?? projets[0].id);
    }
  }, [projets]);

  // Load team members
  useEffect(() => {
    async function load() {
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
    load();
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

  // ─── Save ────────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!titre.trim() || !selectedProjetId || !user || !team) return;
    setIsSaving(true);
    try {
      const localTeam = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM teams WHERE server_id = ?', team.id,
      );
      const localUser = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM users WHERE server_id = ?', user.id,
      );
      if (!localTeam || !localUser) return;

      const tache = await createTache(db, {
        titre: titre.trim(),
        description: description.trim() || undefined,
        statut,
        projet_id: selectedProjetId,
        auteur_id: localUser.id,
        assigne_id: assigneId,
        team_id: localTeam.id,
        due_date: dueDate ? dueDate.toISOString() : null,
      });

      pushTache(db, tache.id, team.id); // fire and forget
      router.back();
    } finally {
      setIsSaving(false);
    }
  }, [titre, description, selectedProjetId, statut, assigneId, dueDate, user, team, db]);

  const canSave = titre.trim().length > 0 && selectedProjetId !== null;

  const formatDueDate = (d: Date) =>
    d.toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const membreLabel = (m: Membre) =>
    m.prenom ? `${m.prenom} ${m.nom}` : m.nom;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="close" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Nouvelle tâche</Text>
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
              {selectedProjet ? selectedProjet.titre : 'Choisir un projet…'}
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

          {/* Assigné à */}
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
              <Ionicons
                name="calendar-outline"
                size={18}
                color={dueDate ? Colors.primary : Colors.textSecondary}
              />
              <Text style={[styles.selectorText, !dueDate && { color: Colors.textDisabled }]}>
                {dueDate ? formatDueDate(dueDate) : 'Choisir une date et heure…'}
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

      {/* ── Android date/time picker (dialog natif) ─────────────────────────── */}
      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={tempDate}
          mode={pickerStep}
          display="default"
          onChange={onAndroidPickerChange}
        />
      )}

      {/* ── iOS date/time picker (bottom sheet) ─────────────────────────────── */}
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

      {/* ── Projet picker ────────────────────────────────────────────────────── */}
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
                {selectedProjetId === item.id && (
                  <Ionicons name="checkmark" size={18} color={Colors.primary} />
                )}
              </Pressable>
            )}
          />
        </View>
      </Modal>

      {/* ── Assigné picker ───────────────────────────────────────────────────── */}
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
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.screenPaddingH,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  saveBtn: {
    paddingHorizontal: 16, height: 34, borderRadius: 17,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', minWidth: 110,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  body: { flex: 1, paddingHorizontal: Layout.screenPaddingH },

  section: { marginTop: 16, marginBottom: 4 },
  sectionLabel: {
    fontSize: 11, fontWeight: '600', color: Colors.textSecondary,
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },

  selectorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 11,
    borderRadius: 10, backgroundColor: Colors.surfaceAlt,
    borderWidth: 1, borderColor: Colors.border,
    marginTop: 16,
  },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 11,
    borderRadius: 10, backgroundColor: Colors.surfaceAlt,
    borderWidth: 1, borderColor: Colors.border,
  },
  selectorDot: { width: 10, height: 10, borderRadius: 5 },
  selectorText: { flex: 1, fontSize: 14, fontWeight: '500', color: Colors.textPrimary },

  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border,
  },
  chipDot: { width: 7, height: 7, borderRadius: 3.5 },
  chipText: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },

  titleInput: {
    fontSize: 22, fontWeight: '700', color: Colors.textPrimary,
    paddingTop: 16, paddingBottom: 12, lineHeight: 30,
  },
  divider: { height: 1, backgroundColor: Colors.border, marginBottom: 4 },
  descInput: {
    fontSize: 15, color: Colors.textPrimary, lineHeight: 22,
    minHeight: 120, paddingBottom: 16,
    paddingHorizontal: 12, paddingTop: 12,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface, textAlignVertical: 'top',
  },

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
