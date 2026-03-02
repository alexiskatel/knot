/**
 * Modal "Ajouter un groupe" — permet de rejoindre un groupe existant
 * OU d'en créer un nouveau depuis les settings.
 */
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';

import { bootstrapTeam, validateApiKey, validateTeamCode, type TeamInfo } from '@/src/api/auth';
import { Button } from '@/src/components/shared/Button';
import { Input } from '@/src/components/shared/Input';
import { Colors } from '@/src/constants/colors';
import { Layout } from '@/src/constants/layout';
import { useAuth } from '@/src/contexts/AuthContext';

type Mode = 'choose' | 'join-code' | 'join-key' | 'create-nom' | 'create-code' | 'create-admin' | 'create-result';

interface CreateResult {
  teamId: number; teamNom: string; codeUnique: string; couleur: string;
  userId: number; userNom: string; userPrenom: string; userEmail: string; apiKey: string;
}

export default function AddAccountModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const db = useSQLiteContext();
  const { addAccount, signIn } = useAuth();

  const [mode, setMode] = useState<Mode>('choose');
  const [teamCode, setTeamCode] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const [createNom, setCreateNom] = useState('');
  const [createCode, setCreateCode] = useState('');
  const [adminNom, setAdminNom] = useState('');
  const [adminPrenom, setAdminPrenom] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [createResult, setCreateResult] = useState<CreateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setMode('choose');
    setTeamCode(''); setApiKey(''); setTeamInfo(null);
    setCreateNom(''); setCreateCode(''); setAdminNom(''); setAdminPrenom(''); setAdminEmail('');
    setCreateResult(null); setLoading(false); setError('');
  }

  function handleClose() { reset(); onClose(); }

  // ── Join existing group ───────────────────────────────────────────────────

  async function handleValidateCode() {
    const code = teamCode.trim().toUpperCase();
    if (!code) { setError('Veuillez saisir le code.'); return; }
    setError(''); setLoading(true);
    try {
      const team = await validateTeamCode(code);
      setTeamInfo(team);
      setMode('join-key');
    } catch (e: any) {
      setError(e.message ?? 'Code invalide.');
    } finally { setLoading(false); }
  }

  async function handleValidateKey() {
    const key = apiKey.trim();
    if (!key || !teamInfo) return;
    setError(''); setLoading(true);
    try {
      const { user, team } = await validateApiKey(key, teamInfo.id);
      await addAccount(key, { ...user, is_admin: user.is_admin ?? false }, team);
      // Switch to new account
      Alert.alert('Compte ajouté', `Vous avez rejoint "${team.nom}".`);
      handleClose();
    } catch (e: any) {
      setError(e.message ?? 'Clé invalide.');
    } finally { setLoading(false); }
  }

  // ── Create new group ──────────────────────────────────────────────────────

  function handleCreateNomNext() {
    if (!createNom.trim()) { setError('Veuillez saisir le nom.'); return; }
    const base = createNom.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 5);
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    if (!createCode) setCreateCode(`${base}-${suffix}`);
    setError(''); setMode('create-code');
  }

  function handleCreateCodeNext() {
    const code = createCode.trim().toUpperCase();
    if (!code || code.length < 3) { setError('Code trop court (min 3).'); return; }
    setCreateCode(code); setError(''); setMode('create-admin');
  }

  async function handleCreateSubmit() {
    if (!adminNom.trim()) { setError('Veuillez saisir votre nom.'); return; }
    if (!adminPrenom.trim()) { setError('Veuillez saisir votre prénom.'); return; }
    if (!adminEmail.trim()) { setError('Veuillez saisir votre email.'); return; }
    setError(''); setLoading(true);
    try {
      const result = await bootstrapTeam({
        nom: createNom.trim(),
        code_unique: createCode.trim().toUpperCase(),
        admin_nom: adminNom.trim(),
        admin_prenom: adminPrenom.trim(),
        admin_email: adminEmail.trim(),
      });
      setCreateResult({
        teamId: result.team.id, teamNom: result.team.nom,
        codeUnique: result.team.code_unique, couleur: result.team.couleur_primaire,
        userId: result.user.id, userNom: result.user.nom,
        userPrenom: result.user.prenom ?? '', userEmail: result.user.email ?? '',
        apiKey: result.api_key,
      });
      setMode('create-result');
    } catch (e: any) {
      setError(e.message ?? 'Erreur lors de la création.');
    } finally { setLoading(false); }
  }

  async function handleCreateAccess() {
    if (!createResult) return;
    setLoading(true);
    try {
      await addAccount(createResult.apiKey, {
        id: createResult.userId, nom: createResult.userNom,
        prenom: createResult.userPrenom, email: createResult.userEmail, is_admin: true,
      }, { id: createResult.teamId, nom: createResult.teamNom, couleur_primaire: createResult.couleur });
      handleClose();
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally { setLoading(false); }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaHeader onClose={handleClose} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* ── Choose ── */}
          {mode === 'choose' && (
            <View>
              <Text style={styles.title}>Ajouter un groupe</Text>
              <Text style={styles.subtitle}>Rejoignez un espace existant ou créez-en un nouveau.</Text>

              <Pressable style={styles.choiceCard} onPress={() => setMode('join-code')}>
                <Ionicons name="enter-outline" size={28} color={Colors.primary} />
                <View style={styles.choiceText}>
                  <Text style={styles.choiceTitle}>Rejoindre un groupe</Text>
                  <Text style={styles.choiceDesc}>J'ai un code et une clé API</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textDisabled} />
              </Pressable>

              <Pressable style={styles.choiceCard} onPress={() => setMode('create-nom')}>
                <Ionicons name="add-circle-outline" size={28} color={Colors.primary} />
                <View style={styles.choiceText}>
                  <Text style={styles.choiceTitle}>Créer un nouveau groupe</Text>
                  <Text style={styles.choiceDesc}>Je veux créer mon propre espace</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textDisabled} />
              </Pressable>
            </View>
          )}

          {/* ── Join: code ── */}
          {mode === 'join-code' && (
            <View>
              <BackBtn onPress={() => { setMode('choose'); setError(''); }} />
              <Text style={styles.title}>Code du groupe</Text>
              <Text style={styles.subtitle}>Saisissez le code de l'espace que vous souhaitez rejoindre.</Text>
              <Input
                label="Code team"
                value={teamCode}
                onChangeText={(t) => { setTeamCode(t); setError(''); }}
                placeholder="ex: ACME-AB12"
                autoCapitalize="characters"
                maxLength={12}
                autoFocus
                error={error}
              />
              <View style={{ height: 16 }} />
              <Button label="Valider" onPress={handleValidateCode} loading={loading}
                disabled={teamCode.trim().length < 3} style={styles.btn} />
            </View>
          )}

          {/* ── Join: key ── */}
          {mode === 'join-key' && teamInfo && (
            <View>
              <BackBtn onPress={() => { setMode('join-code'); setError(''); }} />
              <View style={[styles.teamBadge, { borderColor: teamInfo.couleur_primaire }]}>
                <View style={[styles.teamDot, { backgroundColor: teamInfo.couleur_primaire }]} />
                <Text style={styles.teamName}>{teamInfo.nom}</Text>
                <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
              </View>
              <Text style={styles.title}>Votre clé d'accès</Text>
              <Text style={styles.subtitle}>Clé fournie par votre administrateur.</Text>
              <Input
                label="Clé API"
                value={apiKey}
                onChangeText={(t) => { setApiKey(t); setError(''); }}
                placeholder="Votre clé"
                secureTextEntry
                maxLength={12}
                autoFocus
                error={error}
              />
              <View style={{ height: 16 }} />
              <Button label="Rejoindre" onPress={handleValidateKey} loading={loading}
                disabled={apiKey.trim().length < 12} style={styles.btn} />
            </View>
          )}

          {/* ── Create: nom ── */}
          {mode === 'create-nom' && (
            <View>
              <BackBtn onPress={() => { setMode('choose'); setError(''); }} />
              <Text style={styles.title}>Nom du groupe</Text>
              <Text style={styles.subtitle}>Quel est le nom de votre espace de travail ?</Text>
              <Input label="Nom du groupe" value={createNom}
                onChangeText={(t) => { setCreateNom(t); setError(''); }}
                placeholder="ex: Mon Équipe" autoFocus error={error} />
              <View style={{ height: 16 }} />
              <Button label="Suivant" onPress={handleCreateNomNext}
                disabled={createNom.trim().length < 2} style={styles.btn} />
            </View>
          )}

          {/* ── Create: code ── */}
          {mode === 'create-code' && (
            <View>
              <BackBtn onPress={() => { setMode('create-nom'); setError(''); }} />
              <Text style={styles.title}>Code unique</Text>
              <Text style={styles.subtitle}>Ce code servira aux membres pour rejoindre votre groupe.</Text>
              <Input label="Code" value={createCode}
                onChangeText={(t) => { setCreateCode(t.toUpperCase()); setError(''); }}
                autoCapitalize="characters" maxLength={20} autoFocus error={error} />
              <View style={{ height: 16 }} />
              <Button label="Suivant" onPress={handleCreateCodeNext}
                disabled={createCode.trim().length < 3} style={styles.btn} />
            </View>
          )}

          {/* ── Create: admin ── */}
          {mode === 'create-admin' && (
            <View>
              <BackBtn onPress={() => { setMode('create-code'); setError(''); }} />
              <Text style={styles.title}>Votre profil</Text>
              <Text style={styles.subtitle}>Vous serez administrateur du groupe.</Text>
              <Input label="Nom" value={adminNom}
                onChangeText={(t) => { setAdminNom(t); setError(''); }}
                placeholder="Votre nom" autoFocus />
              <View style={{ height: 10 }} />
              <Input label="Prénom" value={adminPrenom}
                onChangeText={(t) => { setAdminPrenom(t); setError(''); }} placeholder="Votre prénom" />
              <View style={{ height: 10 }} />
              <Input label="Email" value={adminEmail}
                onChangeText={(t) => { setAdminEmail(t); setError(''); }}
                placeholder="votre@email.com" keyboardType="email-address"
                autoCapitalize="none" error={error} />
              <View style={{ height: 16 }} />
              <Button label="Créer le groupe" onPress={handleCreateSubmit} loading={loading}
                disabled={!adminNom.trim() || !adminPrenom.trim() || !adminEmail.trim()} style={styles.btn} />
            </View>
          )}

          {/* ── Create: result ── */}
          {mode === 'create-result' && createResult && (
            <View>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={40} color={Colors.success} />
              </View>
              <Text style={styles.title}>Groupe créé !</Text>
              <Text style={styles.subtitle}>Partagez ces infos aux membres.</Text>

              <View style={styles.resultBox}>
                <Text style={styles.resultLabel}>Code du groupe</Text>
                <Pressable style={styles.resultRow}
                  onPress={() => Share.share({ message: createResult.codeUnique })}>
                  <Text style={styles.resultValue}>{createResult.codeUnique}</Text>
                  <Ionicons name="copy-outline" size={16} color={Colors.textSecondary} />
                </Pressable>
              </View>

              <View style={styles.resultBox}>
                <Text style={styles.resultLabel}>Votre clé API (admin)</Text>
                <Pressable style={styles.resultRow}
                  onPress={() => Share.share({ message: createResult.apiKey })}>
                  <Text style={[styles.resultValue, { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]}>
                    {createResult.apiKey}
                  </Text>
                  <Ionicons name="copy-outline" size={16} color={Colors.textSecondary} />
                </Pressable>
                <Text style={styles.resultHint}>Conservez cette clé précieusement.</Text>
              </View>

              <Button label="Accéder à cet espace" onPress={handleCreateAccess}
                loading={loading} style={styles.btn} />
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function SafeAreaHeader({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Groupe</Text>
      <Pressable onPress={onClose} hitSlop={12}>
        <Ionicons name="close" size={22} color={Colors.textPrimary} />
      </Pressable>
    </View>
  );
}

function BackBtn({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.backBtn}>
      <Ionicons name="arrow-back" size={18} color={Colors.textSecondary} />
      <Text style={styles.backLabel}>Retour</Text>
    </Pressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },

  scroll: {
    flexGrow: 1, padding: 20, paddingBottom: 40,
  },
  title: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 24 },
  btn: { width: '100%' },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16, alignSelf: 'flex-start' },
  backLabel: { fontSize: 14, color: Colors.textSecondary },

  choiceCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, borderRadius: 12, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 12,
  },
  choiceText: { flex: 1 },
  choiceTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  choiceDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

  teamBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1,
    backgroundColor: Colors.surfaceAlt, marginBottom: 20, alignSelf: 'flex-start',
  },
  teamDot: { width: 8, height: 8, borderRadius: 4 },
  teamName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },

  successIcon: { alignItems: 'center', marginBottom: 12 },
  resultBox: {
    backgroundColor: Colors.surfaceAlt, borderRadius: 10, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: Colors.border,
  },
  resultLabel: {
    fontSize: 11, fontWeight: '600', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
  },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultValue: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, letterSpacing: 1 },
  resultHint: { fontSize: 11, color: Colors.textDisabled, marginTop: 4 },
});
