import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/src/contexts/AuthContext';
import { useProjets } from '@/src/hooks/useProjets';
import { createNote } from '@/src/db/notes';
import { pushNote } from '@/src/services/sync';
import { Colors } from '@/src/constants/colors';
import { Layout } from '@/src/constants/layout';

export default function CreateNoteScreen() {
  const router = useRouter();
  const { projetId: projetIdParam } = useLocalSearchParams<{ projetId?: string }>();
  const db = useSQLiteContext();
  const { user, team } = useAuth();
  const { projets } = useProjets();

  const [titre, setTitre] = useState('');
  const [contenu, setContenu] = useState('');
  const [selectedProjetId, setSelectedProjetId] = useState<number | null>(null);
  const [statut, setStatut] = useState<'brouillon' | 'publie'>('publie');
  const [showProjetPicker, setShowProjetPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (projets.length > 0 && selectedProjetId === null) {
      const paramId = projetIdParam ? Number(projetIdParam) : null;
      const match = paramId ? projets.find((p) => p.id === paramId) : null;
      setSelectedProjetId(match?.id ?? projets[0].id);
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

      const note = await createNote(db, {
        titre: titre.trim(),
        contenu: contenu.trim(),
        statut,
        projet_id: selectedProjetId,
        auteur_id: localUser.id,
        team_id: localTeam.id,
      });

      pushNote(db, note.id, team.id); // fire and forget
      router.back();
    } finally {
      setIsSaving(false);
    }
  }, [titre, contenu, selectedProjetId, statut, user, team, db]);

  const canSave = titre.trim().length > 0 && selectedProjetId !== null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="close" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Nouvelle note</Text>
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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">

          {/* Projet + Statut row */}
          <View style={styles.metaRow}>
            <Pressable onPress={() => setShowProjetPicker(true)} style={styles.projetSelector}>
              <View style={[styles.projetDot, { backgroundColor: selectedProjet?.couleur ?? Colors.border }]} />
              <Text style={[styles.projetSelectorText, !selectedProjet && { color: Colors.textDisabled }]}>
                {selectedProjet ? selectedProjet.titre : 'Projet…'}
              </Text>
              <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} />
            </Pressable>

            <View style={styles.statutRow}>
              {(['brouillon', 'publie'] as const).map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setStatut(s)}
                  style={[styles.statutChip, statut === s && styles.statutChipActive]}
                >
                  <Text style={[styles.statutChipText, statut === s && styles.statutChipTextActive]}>
                    {s === 'brouillon' ? 'Brouillon' : 'Publié'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Titre */}
          <TextInput
            style={styles.titleInput}
            placeholder="Titre de la note"
            placeholderTextColor={Colors.textDisabled}
            value={titre}
            onChangeText={setTitre}
            multiline
            maxLength={200}
          />

          <View style={styles.divider} />

          {/* Contenu */}
          <TextInput
            style={styles.contentInput}
            placeholder="Commencez à écrire…"
            placeholderTextColor={Colors.textDisabled}
            value={contenu}
            onChangeText={setContenu}
            multiline
            textAlignVertical="top"
          />

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

  // Header
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
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

  // Body
  body: { flex: 1, paddingHorizontal: Layout.screenPaddingH },

  // Meta row
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 16,
    paddingBottom: 8,
    flexWrap: 'wrap',
  },
  projetSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  projetDot: { width: 8, height: 8, borderRadius: 4 },
  projetSelectorText: { fontSize: 13, fontWeight: '500', color: Colors.textPrimary },

  statutRow: { flexDirection: 'row', gap: 6 },
  statutChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statutChipActive: {
    backgroundColor: Colors.primary + '18',
    borderColor: Colors.primary,
  },
  statutChipText: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },
  statutChipTextActive: { color: Colors.primary },

  // Inputs
  titleInput: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    paddingTop: 8,
    paddingBottom: 12,
    lineHeight: 30,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 12,
  },
  contentInput: {
    fontSize: 16,
    color: Colors.textPrimary,
    lineHeight: 24,
    minHeight: 300,
    paddingBottom: 100,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
  },
  modalSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '60%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    paddingHorizontal: Layout.screenPaddingH,
    paddingBottom: 12,
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
