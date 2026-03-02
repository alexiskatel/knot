import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';

import { api } from '@/src/api/client';
import { Button } from '@/src/components/shared/Button';
import { Input } from '@/src/components/shared/Input';
import { Colors } from '@/src/constants/colors';
import { Layout } from '@/src/constants/layout';
import { useAuth } from '@/src/contexts/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Member {
  id: number;
  nom: string;
  prenom: string | null;
  email: string | null;
  is_admin: boolean;
  statut: boolean;
}

interface ProjetItem {
  id: number;
  server_id: number | null;
  titre: string;
  couleur: string;
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function MembersScreen() {
  const router = useRouter();
  const { user, team } = useAuth();
  const db = useSQLiteContext();

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamNom, setTeamNom] = useState(team?.nom ?? '');
  const [teamCode, setTeamCode] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  // Per-member loading (toggle admin, toggle status)
  const [loadingMemberIds, setLoadingMemberIds] = useState<Set<number>>(new Set());

  function setMemberLoading(id: number, value: boolean) {
    setLoadingMemberIds((prev) => {
      const next = new Set(prev);
      if (value) { next.add(id); } else { next.delete(id); }
      return next;
    });
  }

  // Add member modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newNom, setNewNom] = useState('');
  const [newPrenom, setNewPrenom] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  // Regenerate key modal
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [regenTarget, setRegenTarget] = useState<Member | null>(null);
  const [regenKey, setRegenKey] = useState<string | null>(null);
  const [regenLoading, setRegenLoading] = useState(false);

  // Projet access modal
  const [showProjetAccessModal, setShowProjetAccessModal] = useState(false);
  const [projetAccessTarget, setProjetAccessTarget] = useState<Member | null>(null);
  const [allProjets, setAllProjets] = useState<ProjetItem[]>([]);
  const [memberProjetIds, setMemberProjetIds] = useState<Set<number>>(new Set());
  const [accessLoading, setAccessLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadMembers();
    }, [team?.id]),
  );

  async function loadMembers() {
    if (!team?.id) return;
    setLoading(true);
    try {
      const [teamRes, membersRes] = await Promise.all([
        api.get<any>(`/teams/${team.id}`),
        api.get<any>(`/teams/${team.id}/members?include_inactive=1`),
      ]);
      const teamData = teamRes?.list ?? teamRes;
      if (teamData?.code_unique) setTeamCode(teamData.code_unique);
      if (teamData?.nom) setTeamNom(teamData.nom);
      const list = Array.isArray(membersRes?.list) ? membersRes.list : [];
      setMembers(list);
    } catch (e) {
      console.warn('[Members] load error:', e);
    } finally {
      setLoading(false);
    }
  }

  // ── Toggle admin ──────────────────────────────────────────────────────────

  function handleToggleAdmin(member: Member) {
    const action = member.is_admin ? 'retirer les droits admin de' : 'donner les droits admin à';
    Alert.alert(
      'Modifier les droits',
      `Voulez-vous ${action} ${member.prenom ?? ''} ${member.nom} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setMemberLoading(member.id, true);
            try {
              await api.post('/auth/toggle-admin', { user_id: member.id });
              await loadMembers();
            } catch (e: any) {
              Alert.alert('Erreur', e.message ?? 'Impossible de modifier les droits.');
            } finally {
              setMemberLoading(member.id, false);
            }
          },
        },
      ],
    );
  }

  // ── Toggle active status ───────────────────────────────────────────────────

  function handleToggleStatus(member: Member) {
    const action = member.statut ? 'désactiver' : 'réactiver';
    const name = member.prenom ? `${member.prenom} ${member.nom}` : member.nom;
    Alert.alert(
      member.statut ? 'Désactiver ce membre' : 'Réactiver ce membre',
      `Voulez-vous ${action} le compte de ${name} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: member.statut ? 'Désactiver' : 'Réactiver',
          style: member.statut ? 'destructive' : 'default',
          onPress: async () => {
            setMemberLoading(member.id, true);
            try {
              await api.post('/auth/toggle-status', { user_id: member.id });
              await loadMembers();
            } catch (e: any) {
              Alert.alert('Erreur', e.message ?? 'Impossible de modifier le compte.');
            } finally {
              setMemberLoading(member.id, false);
            }
          },
        },
      ],
    );
  }

  // ── Regenerate key ────────────────────────────────────────────────────────

  function openRegenModal(member: Member) {
    setRegenTarget(member);
    setRegenKey(null);
    setShowRegenModal(true);
  }

  async function handleRegenerate() {
    if (!regenTarget) return;
    setRegenLoading(true);
    try {
      const res = await api.post<any>('/auth/regenerate-key', { user_id: regenTarget.id });
      const newKey = res?.list?.api_key ?? res?.list?.list?.api_key;
      setRegenKey(newKey ?? null);
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? 'Impossible de régénérer la clé.');
      setShowRegenModal(false);
    } finally {
      setRegenLoading(false);
    }
  }

  // ── Add member ────────────────────────────────────────────────────────────

  async function handleAddMember() {
    if (!newNom.trim()) { setAddError('Veuillez saisir le nom.'); return; }
    if (!newPrenom.trim()) { setAddError('Veuillez saisir le prénom.'); return; }
    if (!newEmail.trim()) { setAddError('Veuillez saisir l\'email.'); return; }
    if (!team?.id) return;
    setAddError('');
    setAddLoading(true);
    try {
      const res = await api.post<any>('/auth/generate-key', {
        nom: newNom.trim(),
        prenom: newPrenom.trim(),
        email: newEmail.trim(),
        team_id: team.id,
      });
      const key = res?.list?.api_key ?? res?.list?.list?.api_key;
      setGeneratedKey(key ?? null);
      await loadMembers();
    } catch (e: any) {
      setAddError(e.message ?? 'Erreur lors de la création.');
    } finally {
      setAddLoading(false);
    }
  }

  function closeAddModal() {
    setShowAddModal(false);
    setNewNom(''); setNewPrenom(''); setNewEmail('');
    setAddError(''); setGeneratedKey(null);
  }

  // ── Projet access ─────────────────────────────────────────────────────────

  async function openProjetAccessModal(member: Member) {
    setProjetAccessTarget(member);
    setShowProjetAccessModal(true);
    setAccessLoading(true);
    try {
      // Charger tous les projets depuis la DB locale
      const localTeam = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM teams WHERE server_id = ?', team!.id,
      );
      if (!localTeam) return;
      const projets = await db.getAllAsync<ProjetItem>(
        'SELECT id, server_id, titre, couleur FROM projets WHERE team_id = ? AND deleted_at IS NULL ORDER BY titre',
        localTeam.id,
      );
      setAllProjets(projets);

      // Charger les pairs depuis la DB locale pour ce membre (par server_id)
      const localMember = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM users WHERE server_id = ?', member.id,
      );
      if (localMember) {
        const pairs = await db.getAllAsync<{ projet_id: number }>(
          'SELECT projet_id FROM projet_membres WHERE user_id = ?', localMember.id,
        );
        setMemberProjetIds(new Set(pairs.map((p) => p.projet_id)));
      } else {
        setMemberProjetIds(new Set());
      }
    } finally {
      setAccessLoading(false);
    }
  }

  function toggleMemberProjet(projetLocalId: number) {
    setMemberProjetIds((prev) => {
      const next = new Set(prev);
      if (next.has(projetLocalId)) next.delete(projetLocalId);
      else next.add(projetLocalId);
      return next;
    });
  }

  async function handleSaveProjetAccess() {
    if (!projetAccessTarget) return;
    setAccessLoading(true);
    try {
      // Convertir les local IDs → server IDs
      const serverProjetIds: number[] = [];
      for (const localId of memberProjetIds) {
        const p = allProjets.find((pr) => pr.id === localId);
        if (p?.server_id) serverProjetIds.push(p.server_id);
      }
      await api.put(`/membres/${projetAccessTarget.id}/projets`, { projet_ids: serverProjetIds });
      setShowProjetAccessModal(false);
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? 'Impossible de sauvegarder les accès.');
    } finally {
      setAccessLoading(false);
    }
  }

  // ── Save team info (nom + code) ───────────────────────────────────────────

  async function handleSaveTeam() {
    const nom = teamNom.trim();
    const code = teamCode.trim().toUpperCase();
    if (!nom || nom.length < 2) { Alert.alert('Erreur', 'Le nom doit contenir au moins 2 caractères.'); return; }
    if (!code || code.length < 3) { Alert.alert('Erreur', 'Le code doit contenir au moins 3 caractères.'); return; }
    if (!team?.id) return;
    setSaveLoading(true);
    try {
      await api.put(`/teams/${team.id}`, { nom, code_unique: code });
      setTeamCode(code);
      Alert.alert('Succès', 'Informations du groupe mises à jour.');
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? 'Impossible de mettre à jour le groupe.');
    } finally {
      setSaveLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Membres</Text>
        <Pressable onPress={() => setShowAddModal(true)} hitSlop={12}>
          <Ionicons name="person-add-outline" size={22} color={Colors.primary} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Team info */}
        <Text style={styles.sectionLabel}>Groupe</Text>
        <View style={styles.teamInfoBlock}>
          <Input
            label="Nom du groupe"
            value={teamNom}
            onChangeText={setTeamNom}
            placeholder="Nom du groupe"
          />
          <View style={{ height: 10 }} />
          <Input
            label="Code d'accès"
            value={teamCode}
            onChangeText={(t) => setTeamCode(t.toUpperCase())}
            placeholder="CODE-XXXX"
            autoCapitalize="characters"
          />
          <View style={{ height: 14 }} />
          <Button
            label="Sauvegarder"
            onPress={handleSaveTeam}
            loading={saveLoading}
            disabled={teamNom.trim().length < 2 || teamCode.trim().length < 3}
            style={{ width: '100%' }}
          />
        </View>

        {/* Members list */}
        <Text style={styles.sectionLabel}>Membres ({members.length})</Text>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 32 }} color={Colors.primary} />
        ) : members.length === 0 ? (
          <Text style={styles.empty}>Aucun membre trouvé.</Text>
        ) : (
          members.map((m) => (
            <MemberCard
              key={m.id}
              member={m}
              isSelf={m.id === user?.id}
              isAdmin={!!user?.is_admin}
              isActionLoading={loadingMemberIds.has(m.id)}
              onToggleAdmin={() => handleToggleAdmin(m)}
              onToggleStatus={() => handleToggleStatus(m)}
              onRegenKey={() => openRegenModal(m)}
              onProjetAccess={() => openProjetAccessModal(m)}
            />
          ))
        )}
      </ScrollView>

      {/* Add member modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={closeAddModal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Ajouter un membre</Text>
          <Pressable onPress={closeAddModal} hitSlop={12}>
            <Ionicons name="close" size={22} color={Colors.textPrimary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
          {generatedKey ? (
            <View>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={40} color={Colors.success} />
              </View>
              <Text style={styles.modalSubtitle}>
                Membre ajouté ! Partagez cette clé au nouveau membre.
              </Text>
              <View style={styles.resultBox}>
                <Text style={styles.resultLabel}>Clé API</Text>
                <Pressable style={styles.resultRow}
                  onPress={() => Share.share({ message: generatedKey })}>
                  <Text style={[styles.resultValue, { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]}>
                    {generatedKey}
                  </Text>
                  <Ionicons name="copy-outline" size={16} color={Colors.textSecondary} />
                </Pressable>
              </View>
              <Button label="Fermer" onPress={closeAddModal} style={{ width: '100%' }} />
            </View>
          ) : (
            <View>
              <Text style={styles.modalSubtitle}>
                Un compte sera créé et une clé API générée.
              </Text>
              <Input label="Nom" value={newNom}
                onChangeText={(t) => { setNewNom(t); setAddError(''); }}
                placeholder="Nom du membre" autoFocus />
              <View style={{ height: 12 }} />
              <Input label="Prénom" value={newPrenom}
                onChangeText={(t) => { setNewPrenom(t); setAddError(''); }}
                placeholder="Prénom du membre" />
              <View style={{ height: 12 }} />
              <Input label="Email" value={newEmail}
                onChangeText={(t) => { setNewEmail(t); setAddError(''); }}
                placeholder="email@exemple.com" keyboardType="email-address"
                autoCapitalize="none" error={addError} />
              <View style={{ height: 20 }} />
              <Button label="Ajouter" onPress={handleAddMember} loading={addLoading}
                disabled={!newNom.trim() || !newPrenom.trim() || !newEmail.trim()} style={{ width: '100%' }} />
            </View>
          )}
        </ScrollView>
      </Modal>

      {/* Projet access modal */}
      <Modal visible={showProjetAccessModal} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setShowProjetAccessModal(false)}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            Accès aux projets — {projetAccessTarget?.prenom ?? ''} {projetAccessTarget?.nom}
          </Text>
          <Pressable onPress={() => setShowProjetAccessModal(false)} hitSlop={12}>
            <Ionicons name="close" size={22} color={Colors.textPrimary} />
          </Pressable>
        </View>

        {accessLoading && !allProjets.length ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
        ) : (
          <FlatList
            data={allProjets}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
            ListHeaderComponent={
              <Pressable
                onPress={() => {
                  const allSelected = allProjets.every((p) => memberProjetIds.has(p.id));
                  if (allSelected) {
                    setMemberProjetIds(new Set());
                  } else {
                    setMemberProjetIds(new Set(allProjets.map((p) => p.id)));
                  }
                }}
                style={[styles.accessRow, { borderBottomWidth: 1, borderBottomColor: Colors.border, marginBottom: 4 }]}
              >
                <View style={styles.accessCheckbox}>
                  {allProjets.length > 0 && allProjets.every((p) => memberProjetIds.has(p.id))
                    ? <Ionicons name="checkbox" size={22} color={Colors.primary} />
                    : <Ionicons name="square-outline" size={22} color={Colors.textDisabled} />
                  }
                </View>
                <Text style={[styles.accessLabel, { fontWeight: '700', color: Colors.textSecondary }]}>
                  {allProjets.every((p) => memberProjetIds.has(p.id)) ? 'Tout décocher' : 'Tout cocher'}
                </Text>
              </Pressable>
            }
            renderItem={({ item }) => {
              const checked = memberProjetIds.has(item.id);
              return (
                <Pressable onPress={() => toggleMemberProjet(item.id)} style={styles.accessRow}>
                  <View style={[styles.accessDot, { backgroundColor: item.couleur }]} />
                  <Text style={styles.accessLabel} numberOfLines={1}>{item.titre}</Text>
                  <View style={styles.accessCheckbox}>
                    {checked
                      ? <Ionicons name="checkbox" size={22} color={Colors.primary} />
                      : <Ionicons name="square-outline" size={22} color={Colors.textDisabled} />
                    }
                  </View>
                </Pressable>
              );
            }}
            ListFooterComponent={
              <View style={{ marginTop: 20 }}>
                <Button
                  label="Sauvegarder"
                  onPress={handleSaveProjetAccess}
                  loading={accessLoading}
                  style={{ width: '100%' }}
                />
              </View>
            }
          />
        )}
      </Modal>

      {/* Regenerate key modal */}
      <Modal visible={showRegenModal} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setShowRegenModal(false)}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Régénérer la clé</Text>
          <Pressable onPress={() => setShowRegenModal(false)} hitSlop={12}>
            <Ionicons name="close" size={22} color={Colors.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.modalScroll}>
          {regenKey ? (
            <View>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={40} color={Colors.success} />
              </View>
              <Text style={styles.modalSubtitle}>
                Nouvelle clé générée pour {regenTarget?.prenom ?? ''} {regenTarget?.nom}.
              </Text>
              <View style={styles.resultBox}>
                <Text style={styles.resultLabel}>Nouvelle clé API</Text>
                <Pressable style={styles.resultRow}
                  onPress={() => Share.share({ message: regenKey })}>
                  <Text style={[styles.resultValue, { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]}>
                    {regenKey}
                  </Text>
                  <Ionicons name="copy-outline" size={16} color={Colors.textSecondary} />
                </Pressable>
                <Text style={styles.resultHint}>{"L'ancienne clé ne fonctionnera plus."}</Text>
              </View>
              <Button label="Fermer" onPress={() => setShowRegenModal(false)} style={{ width: '100%' }} />
            </View>
          ) : (
            <View>
              <Text style={styles.modalSubtitle}>
                Générer une nouvelle clé API pour {regenTarget?.prenom ?? ''} {regenTarget?.nom} ?{'\n'}
                {"L'ancienne clé sera invalidée immédiatement."}
              </Text>
              <View style={{ height: 24 }} />
              <Button label="Régénérer la clé" onPress={handleRegenerate} loading={regenLoading}
                style={{ width: '100%' }} />
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Member card ───────────────────────────────────────────────────────────────

function MemberCard({
  member, isSelf, isAdmin, isActionLoading, onToggleAdmin, onToggleStatus, onRegenKey, onProjetAccess,
}: {
  member: Member;
  isSelf: boolean;
  isAdmin: boolean;
  isActionLoading: boolean;
  onToggleAdmin: () => void;
  onToggleStatus: () => void;
  onRegenKey: () => void;
  onProjetAccess: () => void;
}) {
  const initial = member.prenom?.[0] ?? member.nom[0] ?? '?';
  const isDisabled = !member.statut;
  return (
    <View style={[styles.memberCard, isDisabled && styles.memberCardDisabled]}>
      <View style={[styles.memberAvatar, isDisabled && styles.memberAvatarDisabled]}>
        <Text style={styles.memberAvatarText}>{initial.toUpperCase()}</Text>
      </View>
      <View style={styles.memberInfo}>
        <View style={styles.memberNameRow}>
          <Text style={[styles.memberName, isDisabled && styles.memberNameDisabled]}>
            {member.prenom ? `${member.prenom} ${member.nom}` : member.nom}
          </Text>
          {member.is_admin && !isDisabled && (
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>Admin</Text>
            </View>
          )}
          {isDisabled && (
            <View style={styles.disabledBadge}>
              <Text style={styles.disabledBadgeText}>Désactivé</Text>
            </View>
          )}
          {isSelf && (
            <View style={styles.selfBadge}>
              <Text style={styles.selfBadgeText}>Moi</Text>
            </View>
          )}
        </View>
        {member.email ? <Text style={styles.memberEmail} numberOfLines={1}>{member.email}</Text> : null}
      </View>
      {!isSelf && (
        <View style={styles.memberActions}>
          {isActionLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} style={{ width: 32 }} />
          ) : (
            <>
              {!isDisabled && (
                <Pressable onPress={onToggleAdmin} hitSlop={8} style={styles.actionBtn}>
                  <Ionicons
                    name={member.is_admin ? 'shield-checkmark' : 'shield-outline'}
                    size={18}
                    color={member.is_admin ? Colors.primary : Colors.textDisabled}
                  />
                </Pressable>
              )}
              {!isDisabled && (
                <Pressable onPress={onRegenKey} hitSlop={8} style={styles.actionBtn}>
                  <Ionicons name="key-outline" size={18} color={Colors.textDisabled} />
                </Pressable>
              )}
              {isAdmin && !isDisabled && (
                <Pressable onPress={onProjetAccess} hitSlop={8} style={styles.actionBtn}>
                  <Ionicons name="folder-open-outline" size={18} color={Colors.textDisabled} />
                </Pressable>
              )}
              <Pressable onPress={onToggleStatus} hitSlop={8} style={styles.actionBtn}>
                <Ionicons
                  name={isDisabled ? 'person-add-outline' : 'person-remove-outline'}
                  size={18}
                  color={isDisabled ? Colors.success : Colors.error}
                />
              </Pressable>
            </>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Layout.screenPaddingH, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },

  scroll: { padding: Layout.screenPaddingH, paddingBottom: 40 },

  sectionLabel: {
    fontSize: 11, fontWeight: '600', color: Colors.textDisabled,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginTop: 20, marginBottom: 8,
  },

  // Team info block
  teamInfoBlock: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 4,
  },

  empty: { textAlign: 'center', color: Colors.textDisabled, marginTop: 32, fontSize: 14 },

  // Member card
  memberCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, backgroundColor: Colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    marginBottom: 8,
  },
  memberAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  memberAvatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  memberInfo: { flex: 1 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  memberName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  memberEmail: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  memberCardDisabled: { opacity: 0.6, borderColor: Colors.borderLight },
  memberAvatarDisabled: { backgroundColor: Colors.textDisabled },
  memberNameDisabled: { color: Colors.textSecondary },

  adminBadge: {
    backgroundColor: Colors.primary + '20', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  adminBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  disabledBadge: {
    backgroundColor: Colors.error + '15', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  disabledBadgeText: { fontSize: 10, fontWeight: '600', color: Colors.error },
  selfBadge: {
    backgroundColor: Colors.textDisabled + '20', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  selfBadgeText: { fontSize: 10, fontWeight: '600', color: Colors.textDisabled },

  memberActions: { flexDirection: 'row', gap: 4 },
  actionBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center',
  },

  // Modals
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  modalScroll: { padding: 20, paddingBottom: 40, flex: 1 },
  modalSubtitle: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 20 },

  successIcon: { alignItems: 'center', marginBottom: 12 },
  resultBox: {
    backgroundColor: Colors.surfaceAlt, borderRadius: 10, padding: 12,
    marginBottom: 16, borderWidth: 1, borderColor: Colors.border,
  },
  resultLabel: {
    fontSize: 11, fontWeight: '600', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
  },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultValue: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, letterSpacing: 1 },
  resultHint: { fontSize: 11, color: Colors.textDisabled, marginTop: 4 },

  // Projet access modal
  accessRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 13,
  },
  accessDot: { width: 10, height: 10, borderRadius: 5 },
  accessLabel: { flex: 1, fontSize: 15, color: Colors.textPrimary },
  accessCheckbox: { width: 24, alignItems: 'center' },
});
