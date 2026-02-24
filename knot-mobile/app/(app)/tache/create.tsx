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
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/src/contexts/AuthContext';
import { useProjets } from '@/src/hooks/useProjets';
import { createTache, type Tache } from '@/src/db/taches';
import { pushTache } from '@/src/services/sync';
import { Colors } from '@/src/constants/colors';
import { Layout } from '@/src/constants/layout';

const STATUTS: { key: Tache['statut']; label: string; color: string }[] = [
  { key: 'todo',     label: 'À faire',  color: Colors.todo },
  { key: 'en_cours', label: 'En cours', color: Colors.en_cours },
  { key: 'done',     label: 'Terminé',  color: Colors.done },
];

export default function CreateTacheScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { user, team } = useAuth();
  const { projets } = useProjets();

  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProjetId, setSelectedProjetId] = useState<number | null>(null);
  const [statut, setStatut] = useState<Tache['statut']>('todo');
  const [dueDate, setDueDate] = useState('');
  const [showProjetPicker, setShowProjetPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (projets.length > 0 && selectedProjetId === null) {
      setSelectedProjetId(projets[0].id);
    }
  }, [projets]);

  const selectedProjet = projets.find((p) => p.id === selectedProjetId);

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

      // Validate due_date format (YYYY-MM-DD)
      const parsedDate = dueDate.trim().match(/^\d{4}-\d{2}-\d{2}$/) ? dueDate.trim() : null;

      const tache = await createTache(db, {
        titre: titre.trim(),
        description: description.trim() || undefined,
        statut,
        projet_id: selectedProjetId,
        auteur_id: localUser.id,
        team_id: localTeam.id,
        due_date: parsedDate,
      });

      pushTache(db, tache.id, team.id); // fire and forget
      router.back();
    } finally {
      setIsSaving(false);
    }
  }, [titre, description, selectedProjetId, statut, dueDate, user, team, db]);

  const canSave = titre.trim().length > 0 && selectedProjetId !== null;

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

          {/* Projet selector */}
          <Pressable onPress={() => setShowProjetPicker(true)} style={styles.projetSelector}>
            <View style={[styles.projetDot, { backgroundColor: selectedProjet?.couleur ?? Colors.border }]} />
            <Text style={[styles.projetSelectorText, !selectedProjet && { color: Colors.textDisabled }]}>
              {selectedProjet ? selectedProjet.titre : 'Sélectionner un projet'}
            </Text>
            <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} />
          </Pressable>

          {/* Statut */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Statut</Text>
            <View style={styles.statutRow}>
              {STATUTS.map((s) => (
                <Pressable
                  key={s.key}
                  onPress={() => setStatut(s.key)}
                  style={[
                    styles.statutChip,
                    statut === s.key && { backgroundColor: s.color + '20', borderColor: s.color },
                  ]}
                >
                  <View style={[styles.statutDot, { backgroundColor: s.color }]} />
                  <Text style={[styles.statutChipText, statut === s.key && { color: s.color }]}>
                    {s.label}
                  </Text>
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
          <TextInput
            style={styles.descInput}
            placeholder="Description (optionnel)…"
            placeholderTextColor={Colors.textDisabled}
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />

          {/* Date d'échéance */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Date d'échéance</Text>
            <View style={styles.dateInputRow}>
              <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
              <TextInput
                style={styles.dateInput}
                placeholder="AAAA-MM-JJ (ex: 2026-03-15)"
                placeholderTextColor={Colors.textDisabled}
                value={dueDate}
                onChangeText={setDueDate}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Projet Picker Modal */}
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
                style={[styles.projetOption, selectedProjetId === item.id && styles.projetOptionSelected]}
              >
                <View style={[styles.projetOptionDot, { backgroundColor: item.couleur }]} />
                <Text style={styles.projetOptionText}>{item.titre}</Text>
                {selectedProjetId === item.id && (
                  <Ionicons name="checkmark" size={18} color={Colors.primary} />
                )}
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

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
  headerBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  saveBtn: {
    paddingHorizontal: 16,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  body: { flex: 1, paddingHorizontal: Layout.screenPaddingH },

  projetSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 16,
    marginBottom: 8,
  },
  projetDot: { width: 10, height: 10, borderRadius: 5 },
  projetSelectorText: { flex: 1, fontSize: 14, fontWeight: '500', color: Colors.textPrimary },

  section: { marginTop: 16, marginBottom: 4 },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  statutRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statutChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statutDot: { width: 7, height: 7, borderRadius: 3.5 },
  statutChipText: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },

  titleInput: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    paddingTop: 16,
    paddingBottom: 12,
    lineHeight: 30,
  },
  divider: { height: 1, backgroundColor: Colors.border, marginBottom: 12 },
  descInput: {
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 22,
    minHeight: 120,
    paddingBottom: 16,
  },

  dateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dateInput: { flex: 1, fontSize: 14, color: Colors.textPrimary },

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
  projetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Layout.screenPaddingH,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  projetOptionSelected: { backgroundColor: Colors.surfaceAlt },
  projetOptionDot: { width: 12, height: 12, borderRadius: 6 },
  projetOptionText: { flex: 1, fontSize: 15, color: Colors.textPrimary },
});
