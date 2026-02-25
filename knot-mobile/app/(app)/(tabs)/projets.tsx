import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { useSync } from '@/src/contexts/SyncContext';
import { useAuth } from '@/src/contexts/AuthContext';
import { useProjets } from '@/src/hooks/useProjets';
import { deleteProjet, updateProjet } from '@/src/db/projets';
import { api } from '@/src/api/client';
import { pushProjet } from '@/src/services/sync';
import { useSQLiteContext } from 'expo-sqlite';
import { AppHeader } from '@/src/components/shared/AppHeader';
import { Colors } from '@/src/constants/colors';
import { Layout } from '@/src/constants/layout';
import type { Projet } from '@/src/db/projets';

// ─── Color palette ────────────────────────────────────────────────────────────

const PALETTE = [
  '#2F3C73', '#4A5A9A', '#3B82F6', '#0EA5E9',
  '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#6B7280', '#1A1D2E', '#047857',
  '#F8FAFC', '#E2E8F0', '#94A3B8', '#1E293B',
  '#FDE68A', '#FCA5A5', '#A7F3D0', '#DDD6FE',
  '#F0ABFC', '#FB7185', '#38BDF8', '#4ADE80',
  '#FACC15', '#FB923C', '#818CF8', '#2DD4BF',
  '#E11D48', '#C026D3', '#7C3AED', '#2563EB',
  '#059669', '#D97706', '#DB2777', '#4F46E5'
];

// ─── Projet Card ─────────────────────────────────────────────────────────────

function ProjetRow({
  projet,
  onPress,
  onEdit,
  onDelete,
}: {
  projet: Projet;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.projetRow}>
      <View style={[styles.projetRowColor, { backgroundColor: projet.couleur }]} />
      <View style={styles.projetRowInfo}>
        <Text style={styles.projetRowTitle} numberOfLines={1}>{projet.titre}</Text>
        {projet.description && (
          <Text style={styles.projetRowDesc} numberOfLines={1}>{projet.description}</Text>
        )}
      </View>
      <View style={styles.projetRowMeta}>
        <View style={[styles.noteCountBadge, { backgroundColor: projet.couleur + '18' }]}>
          <Text style={[styles.noteCountText, { color: projet.couleur }]}>
            {projet.note_count ?? 0}
          </Text>
          <Ionicons name="document-text-outline" size={11} color={projet.couleur} />
        </View>
        <Pressable onPress={onEdit} style={styles.rowAction}>
          <Ionicons name="pencil-outline" size={16} color={Colors.textSecondary} />
        </Pressable>
        <Pressable onPress={onDelete} style={styles.rowAction}>
          <Ionicons name="trash-outline" size={16} color={Colors.error} />
        </Pressable>
      </View>
    </Pressable>
  );
}

// ─── Create / Edit Modal ──────────────────────────────────────────────────────

function ProjetFormModal({
  visible,
  onClose,
  onSave,
  initial,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (titre: string, description: string, couleur: string) => Promise<void>;
  initial?: Projet | null;
}) {
  const [titre, setTitre] = useState(initial?.titre ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [couleur, setCouleur] = useState(initial?.couleur ?? PALETTE[0]);
  const [saving, setSaving] = useState(false);

  // Reset when modal opens
  const onOpen = useCallback(() => {
    setTitre(initial?.titre ?? '');
    setDescription(initial?.description ?? '');
    setCouleur(initial?.couleur ?? PALETTE[0]);
  }, [initial]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onShow={onOpen}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose} />
      <View style={styles.modalSheet}>
        <View style={styles.modalHandle} />
        <Text style={styles.modalTitle}>{initial ? 'Modifier le projet' : 'Nouveau projet'}</Text>

        <View style={styles.modalBody}>
          {/* Titre */}
          <Text style={styles.fieldLabel}>Nom du projet *</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder="Ex: Marketing Q1"
            placeholderTextColor={Colors.textDisabled}
            value={titre}
            onChangeText={setTitre}
            maxLength={100}
          />

          {/* Description */}
          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Description</Text>
          <TextInput
            style={[styles.fieldInput, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
            placeholder="Optionnel…"
            placeholderTextColor={Colors.textDisabled}
            value={description}
            onChangeText={setDescription}
            multiline
          />

          {/* Couleur */}
          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Couleur</Text>
          <View style={styles.palette}>
            {PALETTE.map((c) => (
              <Pressable
                key={c}
                onPress={() => setCouleur(c)}
                style={[styles.paletteColor, { backgroundColor: c }, couleur === c && styles.paletteColorSelected]}
              >
                {couleur === c && <Ionicons name="checkmark" size={14} color="#fff" />}
              </Pressable>
            ))}
          </View>

          {/* Preview */}
          <View style={[styles.projetPreview, { borderLeftColor: couleur }]}>
            <Text style={styles.projetPreviewText} numberOfLines={1}>
              {titre || 'Nom du projet'}
            </Text>
          </View>

          {/* Buttons */}
          <View style={styles.modalBtns}>
            <Pressable onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                if (!titre.trim()) return;
                setSaving(true);
                await onSave(titre.trim(), description.trim(), couleur);
                setSaving(false);
                onClose();
              }}
              disabled={!titre.trim() || saving}
              style={[styles.saveBtn, (!titre.trim() || saving) && styles.saveBtnDisabled]}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.saveBtnText}>{initial ? 'Enregistrer' : 'Créer'}</Text>
              }
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ProjetsScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { sync } = useSync();
  const { team } = useAuth();
  const { projets, isLoading, refresh, add } = useProjets();
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editProjet, setEditProjet] = useState<Projet | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await sync();
    await refresh();
    setRefreshing(false);
  }, [sync, refresh]);

  const handleCreate = useCallback(async (titre: string, description: string, couleur: string) => {
    const projet = await add({ titre, description, couleur });
    if (projet && team) {
      pushProjet(db, projet.id, team.id); // fire and forget
    }
    await refresh();
  }, [add, refresh, db, team]);

  const handleEdit = useCallback(async (titre: string, description: string, couleur: string) => {
    if (!editProjet) return;
    await updateProjet(db, editProjet.id, { titre, description, couleur });
    if (team) {
      pushProjet(db, editProjet.id, team.id); // fire and forget
    }
    await refresh();
  }, [editProjet, db, refresh, team]);

  const handleDelete = useCallback((projet: Projet) => {
    Alert.alert(
      'Supprimer le projet',
      `Supprimer "${projet.titre}" ? Les notes et tâches associées seront aussi supprimées.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            if (projet.server_id) {
              api.delete(`/projets/${projet.server_id}`).catch((e) => {
                console.warn('[Delete] Projet', projet.server_id, 'échoué:', e);
              });
            }
            await deleteProjet(db, projet.id);
            await refresh();
          },
        },
      ],
    );
  }, [db, refresh, team]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      <AppHeader />

      {/* Bouton nouveau projet */}
      <View style={styles.subHeader}>
        <Pressable onPress={() => setShowCreate(true)} style={styles.addBtn}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Nouveau projet</Text>
        </Pressable>
      </View>

      {/* Liste */}
      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={projets}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 40).springify()}>
              <ProjetRow
                projet={item}
                onPress={() => router.push({ pathname: '/(app)', params: { projetId: item.id } })}
                onEdit={() => setEditProjet(item)}
                onDelete={() => handleDelete(item)}
              />
            </Animated.View>
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
          ListEmptyComponent={
            <Animated.View entering={FadeIn.delay(200)} style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="folder-outline" size={36} color={Colors.textDisabled} />
              </View>
              <Text style={styles.emptyTitle}>Aucun projet</Text>
              <Text style={styles.emptySubtitle}>Créez votre premier projet avec le bouton Nouveau.</Text>
            </Animated.View>
          }
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}

      {/* Create modal */}
      <ProjetFormModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSave={handleCreate}
      />

      {/* Edit modal */}
      <ProjetFormModal
        visible={editProjet !== null}
        onClose={() => setEditProjet(null)}
        onSave={handleEdit}
        initial={editProjet}
      />

    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  subHeader: {
    paddingHorizontal: Layout.screenPaddingH,
    paddingBottom: 12,
    alignItems: 'flex-start',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.primary,
  },
  addBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  list: {
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: 4,
    paddingBottom: 40,
  },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Projet row
  projetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Layout.cardRadius,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  projetRowColor: { width: 6, alignSelf: 'stretch' },
  projetRowInfo: { flex: 1, padding: 14 },
  projetRowTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  projetRowDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  projetRowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 10 },
  noteCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  noteCountText: { fontSize: 12, fontWeight: '700' },
  rowAction: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

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
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay },
  modalSheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 12, marginBottom: 4,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: 8,
    paddingBottom: 4,
  },
  modalBody: { paddingHorizontal: Layout.screenPaddingH, paddingTop: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  fieldInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Layout.inputRadius,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.surfaceAlt,
  },

  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  paletteColor: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paletteColorSelected: {
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },

  projetPreview: {
    borderLeftWidth: 4,
    borderRadius: 8,
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  projetPreviewText: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },

  modalBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: Layout.buttonRadius,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  saveBtn: {
    flex: 1,
    height: 46,
    borderRadius: Layout.buttonRadius,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
