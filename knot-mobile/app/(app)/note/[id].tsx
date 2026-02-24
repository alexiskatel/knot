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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/src/contexts/AuthContext';
import { useProjets } from '@/src/hooks/useProjets';
import { getNoteById, updateNote, deleteNote, type Note } from '@/src/db/notes';
import { pushNote } from '@/src/services/sync';
import { api } from '@/src/api/client';
import { Colors } from '@/src/constants/colors';
import { Layout } from '@/src/constants/layout';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function NoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useSQLiteContext();
  const { team } = useAuth();
  const { projets } = useProjets();

  const [note, setNote] = useState<Note | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  // Edit state
  const [titre, setTitre] = useState('');
  const [contenu, setContenu] = useState('');
  const [selectedProjetId, setSelectedProjetId] = useState<number | null>(null);
  const [statut, setStatut] = useState<'brouillon' | 'publie'>('publie');
  const [showProjetPicker, setShowProjetPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const row = await getNoteById(db, Number(id));
      setNote(row);
      if (row) {
        setTitre(row.titre);
        setContenu(row.contenu);
        setSelectedProjetId(row.projet_id);
        setStatut(row.statut === 'archive' ? 'publie' : row.statut);
      }
    } finally {
      setIsLoading(false);
    }
  }, [db, id]);

  useEffect(() => { load(); }, [load]);

  const selectedProjet = projets.find((p) => p.id === selectedProjetId);

  const handleSave = useCallback(async () => {
    if (!note || !titre.trim() || !selectedProjetId || !team) return;
    setIsSaving(true);
    try {
      await updateNote(db, note.id, {
        titre: titre.trim(),
        contenu: contenu.trim(),
        statut,
        projet_id: selectedProjetId,
      });
      pushNote(db, note.id, team.id); // fire and forget
      await load();
      setEditMode(false);
    } finally {
      setIsSaving(false);
    }
  }, [note, titre, contenu, selectedProjetId, statut, team, db, load]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Supprimer la note',
      'Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            if (!note) return;
            if (note.server_id) {
              api.delete(`/notes/${note.server_id}`).catch((e) => {
                console.warn('[Delete] Note', note.server_id, 'échoué:', e);
              });
            }
            await deleteNote(db, note.id);
            router.back();
          },
        },
      ],
    );
  }, [note, db, router]);

  const handleCancelEdit = useCallback(() => {
    if (note) {
      setTitre(note.titre);
      setContenu(note.contenu);
      setSelectedProjetId(note.projet_id);
      setStatut(note.statut === 'archive' ? 'publie' : note.statut);
    }
    setEditMode(false);
  }, [note]);

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!note) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.notFoundText}>Note introuvable.</Text>
          <Pressable onPress={() => router.back()} style={styles.backLink}>
            <Text style={styles.backLinkText}>Retour</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const canSave = titre.trim().length > 0 && selectedProjetId !== null;
  const isPending = note.sync_status === 'pending';

  // ─── Edit mode ─────────────────────────────────────────────────────────────

  if (editMode) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={handleCancelEdit} style={styles.headerBtn}>
            <Ionicons name="close" size={22} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Modifier la note</Text>
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

  // ─── View mode ─────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
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

        {/* Métadonnées */}
        <View style={styles.noteMeta}>
          {note.projet_titre && (
            <View style={[styles.projetTag, { backgroundColor: (note.projet_couleur ?? Colors.primary) + '18' }]}>
              <View style={[styles.projetDot, { backgroundColor: note.projet_couleur ?? Colors.primary }]} />
              <Text style={[styles.projetTagText, { color: note.projet_couleur ?? Colors.primary }]}>
                {note.projet_titre}
              </Text>
            </View>
          )}
          <View style={[
            styles.statutBadge,
            { backgroundColor: note.statut === 'brouillon' ? Colors.surfaceAlt : Colors.info + '18' },
          ]}>
            <Text style={[
              styles.statutBadgeText,
              { color: note.statut === 'brouillon' ? Colors.textSecondary : Colors.info },
            ]}>
              {note.statut === 'brouillon' ? 'Brouillon' : 'Publié'}
            </Text>
          </View>
          {isPending && (
            <View style={styles.pendingBadge}>
              <Ionicons name="cloud-upload-outline" size={12} color={Colors.textDisabled} />
              <Text style={styles.pendingText}>Non synchronisé</Text>
            </View>
          )}
        </View>

        {/* Titre */}
        <Text style={styles.noteTitle}>{note.titre}</Text>

        {/* Infos auteur + date */}
        <View style={styles.noteInfo}>
          <Text style={styles.noteInfoText}>
            {note.auteur_prenom ? `${note.auteur_prenom} ${note.auteur_nom}` : note.auteur_nom ?? 'Inconnu'}
            {'  ·  '}
            {formatDate(note.updated_at)}
          </Text>
        </View>

        <View style={styles.divider} />

        {/* Contenu */}
        {note.contenu.length > 0
          ? <Text style={styles.noteContent} selectable>{note.contenu}</Text>
          : <Text style={styles.emptyContent}>Aucun contenu.</Text>
        }

        <View style={{ height: 60 }} />
      </ScrollView>
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

  // Header
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  saveBtn: {
    paddingHorizontal: 16,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  // Body
  body: { flex: 1, paddingHorizontal: Layout.screenPaddingH },

  // Note view
  noteMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 20,
    paddingBottom: 8,
    flexWrap: 'wrap',
  },
  projetTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  projetDot: { width: 8, height: 8, borderRadius: 4 },
  projetTagText: { fontSize: 12, fontWeight: '600' },
  statutBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statutBadgeText: { fontSize: 12, fontWeight: '500' },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: Colors.surfaceAlt,
  },
  pendingText: { fontSize: 11, color: Colors.textDisabled },
  noteTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 32,
    paddingTop: 8,
    paddingBottom: 10,
  },
  noteInfo: { paddingBottom: 14 },
  noteInfoText: { fontSize: 12, color: Colors.textSecondary },
  divider: { height: 1, backgroundColor: Colors.border, marginBottom: 16 },
  noteContent: {
    fontSize: 16,
    color: Colors.textPrimary,
    lineHeight: 26,
  },
  emptyContent: { fontSize: 15, color: Colors.textDisabled, fontStyle: 'italic' },

  // Edit mode (shared with create)
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
  statutChipActive: { backgroundColor: Colors.primary + '18', borderColor: Colors.primary },
  statutChipText: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },
  statutChipTextActive: { color: Colors.primary },
  titleInput: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    paddingTop: 8,
    paddingBottom: 12,
    lineHeight: 30,
  },
  contentInput: {
    fontSize: 16,
    color: Colors.textPrimary,
    lineHeight: 24,
    minHeight: 300,
    paddingBottom: 100,
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay },
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
