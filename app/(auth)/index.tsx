import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { TeamInfo } from '@/src/api/auth';
import { bootstrapTeam, validateApiKey, validateTeamCode } from '@/src/api/auth';
import { Button } from '@/src/components/shared/Button';
import { Input } from '@/src/components/shared/Input';
import { Colors } from '@/src/constants/colors';
import { Layout } from '@/src/constants/layout';
import { useAuth } from '@/src/contexts/AuthContext';

// Login steps: team code → api key
// Create steps: group name → code → admin info → result
type Step = 'team' | 'key' | 'create-nom' | 'create-code' | 'create-admin' | 'create-result';

interface CreateResult {
  teamId: number;
  teamNom: string;
  codeUnique: string;
  couleur: string;
  userId: number;
  userNom: string;
  userPrenom: string;
  userEmail: string;
  apiKey: string;
}

export default function AuthScreen() {
  const { signIn } = useAuth();

  const [step, setStep] = useState<Step>('team');

  // Login state
  const [teamCode, setTeamCode] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);

  // Create group state
  const [createNom, setCreateNom] = useState('');
  const [createCode, setCreateCode] = useState('');
  const [adminNom, setAdminNom] = useState('');
  const [adminPrenom, setAdminPrenom] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [createResult, setCreateResult] = useState<CreateResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const totalSteps = step.startsWith('create') ? 4 : 2;
  const currentStepNum =
    step === 'team' ? 1 :
    step === 'key' ? 2 :
    step === 'create-nom' ? 1 :
    step === 'create-code' ? 2 :
    step === 'create-admin' ? 3 :
    4;

  // ── Login flow ─────────────────────────────────────────────────────────────

  async function handleValidateCode() {
    const code = teamCode.trim().toUpperCase();
    if (!code) { setError('Veuillez saisir votre code team.'); return; }
    setError('');
    setLoading(true);
    try {
      const team = await validateTeamCode(code);
      if (!team) { setError('Réponse invalide du serveur.'); return; }
      setTeamInfo(team);
      setStep('key');
    } catch (e: any) {
      setError(e.message ?? 'Code invalide. Vérifiez et réessayez.');
    } finally {
      setLoading(false);
    }
  }

  async function handleValidateKey() {
    const key = apiKey.trim();
    if (!key || !teamInfo) return;
    setError('');
    setLoading(true);
    try {
      const { user, team } = await validateApiKey(key, teamInfo.id);
      await signIn(key, { ...user, is_admin: user.is_admin ?? false }, team);
    } catch (e: any) {
      setError(e.message ?? 'Clé invalide. Vérifiez et réessayez.');
    } finally {
      setLoading(false);
    }
  }

  function handleBackToTeam() {
    setStep('team');
    setApiKey('');
    setTeamInfo(null);
    setError('');
  }

  // ── Create group flow ──────────────────────────────────────────────────────

  function handleStartCreate() {
    setCreateNom('');
    setCreateCode('');
    setAdminNom('');
    setAdminPrenom('');
    setAdminEmail('');
    setCreateResult(null);
    setError('');
    setStep('create-nom');
  }

  function handleCreateNomNext() {
    if (!createNom.trim()) { setError('Veuillez saisir le nom du groupe.'); return; }
    setError('');
    // Auto-suggest code from name
    const base = createNom.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 5);
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    if (!createCode) setCreateCode(`${base}-${suffix}`);
    setStep('create-code');
  }

  function handleCreateCodeNext() {
    const code = createCode.trim().toUpperCase();
    if (!code || code.length < 3) { setError('Le code doit contenir au moins 3 caractères.'); return; }
    setCreateCode(code);
    setError('');
    setStep('create-admin');
  }

  async function handleCreateSubmit() {
    if (!adminNom.trim()) { setError('Veuillez saisir votre nom.'); return; }
    if (!adminPrenom.trim()) { setError('Veuillez saisir votre prénom.'); return; }
    if (!adminEmail.trim()) { setError('Veuillez saisir votre email.'); return; }
    setError('');
    setLoading(true);
    try {
      const result = await bootstrapTeam({
        nom: createNom.trim(),
        code_unique: createCode.trim().toUpperCase(),
        admin_nom: adminNom.trim(),
        admin_prenom: adminPrenom.trim(),
        admin_email: adminEmail.trim(),
      });
      setCreateResult({
        teamId: result.team.id,
        teamNom: result.team.nom,
        codeUnique: result.team.code_unique,
        couleur: result.team.couleur_primaire,
        userId: result.user.id,
        userNom: result.user.nom,
        userPrenom: result.user.prenom ?? '',
        userEmail: result.user.email ?? '',
        apiKey: result.api_key,
      });
      setStep('create-result');
    } catch (e: any) {
      setError(e.message ?? 'Erreur lors de la création. Vérifiez le code (déjà pris ?).');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAccess() {
    if (!createResult) return;
    setLoading(true);
    try {
      await signIn(createResult.apiKey, {
        id: createResult.userId,
        nom: createResult.userNom,
        prenom: createResult.userPrenom,
        email: createResult.userEmail,
        is_admin: true,
      }, {
        id: createResult.teamId,
        nom: createResult.teamNom,
        couleur_primaire: createResult.couleur,
      });
    } catch (e: any) {
      Alert.alert('Erreur', 'Impossible d\'accéder à l\'espace. ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Step indicator ─────────────────────────────────────────────────────────
  const isCreate = step.startsWith('create');

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.logoArea}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>K</Text>
            </View>
            <Text style={styles.appName}>knot</Text>
            <Text style={styles.appTagline}>Collaborez. Organisez. Avancez.</Text>
          </Animated.View>

          {/* Card */}
          <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.card}>

            {/* ── Step: team code ── */}
            {step === 'team' && (
              <View key="step-team">
                <Text style={styles.stepTitle}>Rejoindre votre team.</Text>
                <Text style={styles.stepSubtitle}>
                  Saisissez le code de votre espace de travail.
                </Text>

                <View style={styles.fieldGroup}>
                  <Input
                    label="Code team"
                    value={teamCode}
                    onChangeText={(t) => { setTeamCode(t); setError(''); }}
                    placeholder="ex: ACME-AB12"
                    autoCapitalize="characters"
                    maxLength={12}
                    autoFocus
                    returnKeyType="go"
                    onSubmitEditing={handleValidateCode}
                    error={error}
                  />
                </View>

                <Button
                  label="Valider le code"
                  onPress={handleValidateCode}
                  loading={loading}
                  disabled={teamCode.trim().length < 3}
                  style={styles.btn}
                />

                <Pressable onPress={handleStartCreate} style={styles.createLink}>
                  <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
                  <Text style={styles.createLinkText}>Créer un nouveau groupe</Text>
                </Pressable>
              </View>
            )}

            {/* ── Step: api key ── */}
            {step === 'key' && teamInfo && (
              <View key="step-key">
                <Pressable onPress={handleBackToTeam} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={18} color={Colors.textSecondary} />
                  <Text style={styles.backLabel}>Changer de team</Text>
                </Pressable>

                <View style={[styles.teamBadge, { borderColor: teamInfo.couleur_primaire }]}>
                  <View style={[styles.teamDot, { backgroundColor: teamInfo.couleur_primaire }]} />
                  <Text style={styles.teamName}>{teamInfo.nom}</Text>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                </View>

                <Text style={styles.stepTitle}>Votre clé d'accès</Text>
                <Text style={styles.stepSubtitle}>
                  Saisissez la clé API qui vous a été fournie par votre administrateur.
                </Text>

                <View style={styles.fieldGroup}>
                  <Input
                    label="Clé API"
                    value={apiKey}
                    onChangeText={(t) => { setApiKey(t); setError(''); }}
                    placeholder="Votre clé personnelle"
                    secureTextEntry
                    maxLength={12}
                    autoFocus
                    returnKeyType="go"
                    onSubmitEditing={handleValidateKey}
                    error={error}
                  />
                </View>

                <Button
                  label="Se connecter"
                  onPress={handleValidateKey}
                  loading={loading}
                  disabled={apiKey.trim().length < 12}
                  style={styles.btn}
                />
              </View>
            )}

            {/* ── Step: create — nom du groupe ── */}
            {step === 'create-nom' && (
              <View key="step-create-nom">
                <Pressable onPress={() => setStep('team')} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={18} color={Colors.textSecondary} />
                  <Text style={styles.backLabel}>Retour</Text>
                </Pressable>

                <Text style={styles.stepTitle}>Nouveau groupe</Text>
                <Text style={styles.stepSubtitle}>Quel est le nom de votre espace de travail ?</Text>

                <View style={styles.fieldGroup}>
                  <Input
                    label="Nom du groupe"
                    value={createNom}
                    onChangeText={(t) => { setCreateNom(t); setError(''); }}
                    placeholder="ex: Mon Équipe"
                    autoFocus
                    returnKeyType="next"
                    onSubmitEditing={handleCreateNomNext}
                    error={error}
                  />
                </View>

                <Button
                  label="Suivant"
                  onPress={handleCreateNomNext}
                  disabled={createNom.trim().length < 2}
                  style={styles.btn}
                />
              </View>
            )}

            {/* ── Step: create — code unique ── */}
            {step === 'create-code' && (
              <View key="step-create-code">
                <Pressable onPress={() => setStep('create-nom')} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={18} color={Colors.textSecondary} />
                  <Text style={styles.backLabel}>Retour</Text>
                </Pressable>

                <Text style={styles.stepTitle}>Code du groupe</Text>
                <Text style={styles.stepSubtitle}>
                  Ce code sera utilisé pour rejoindre votre espace. Il doit être unique.
                </Text>

                <View style={styles.fieldGroup}>
                  <Input
                    label="Code unique"
                    value={createCode}
                    onChangeText={(t) => { setCreateCode(t.toUpperCase()); setError(''); }}
                    placeholder="ex: TEAM-AB12"
                    autoCapitalize="characters"
                    maxLength={20}
                    autoFocus
                    returnKeyType="next"
                    onSubmitEditing={handleCreateCodeNext}
                    error={error}
                  />
                </View>

                <Button
                  label="Suivant"
                  onPress={handleCreateCodeNext}
                  disabled={createCode.trim().length < 3}
                  style={styles.btn}
                />
              </View>
            )}

            {/* ── Step: create — admin info ── */}
            {step === 'create-admin' && (
              <View key="step-create-admin">
                <Pressable onPress={() => setStep('create-code')} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={18} color={Colors.textSecondary} />
                  <Text style={styles.backLabel}>Retour</Text>
                </Pressable>

                <Text style={styles.stepTitle}>Votre profil admin</Text>
                <Text style={styles.stepSubtitle}>
                  Renseignez vos informations — vous serez administrateur du groupe.
                </Text>

                <View style={styles.fieldGroup}>
                  <Input
                    label="Nom"
                    value={adminNom}
                    onChangeText={(t) => { setAdminNom(t); setError(''); }}
                    placeholder="Votre nom"
                    autoFocus
                    returnKeyType="next"
                  />
                  <View style={{ height: 12 }} />
                  <Input
                    label="Prénom"
                    value={adminPrenom}
                    onChangeText={(t) => { setAdminPrenom(t); setError(''); }}
                    placeholder="Votre prénom"
                    returnKeyType="next"
                  />
                  <View style={{ height: 12 }} />
                  <Input
                    label="Email"
                    value={adminEmail}
                    onChangeText={(t) => { setAdminEmail(t); setError(''); }}
                    placeholder="votre@email.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    returnKeyType="done"
                    onSubmitEditing={handleCreateSubmit}
                    error={error}
                  />
                </View>

                <Button
                  label="Créer le groupe"
                  onPress={handleCreateSubmit}
                  loading={loading}
                  disabled={!adminNom.trim() || !adminPrenom.trim() || !adminEmail.trim()}
                  style={styles.btn}
                />
              </View>
            )}

            {/* ── Step: create — result ── */}
            {step === 'create-result' && createResult && (
              <View key="step-create-result">
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark-circle" size={40} color={Colors.success} />
                </View>

                <Text style={styles.stepTitle}>Groupe créé !</Text>
                <Text style={styles.stepSubtitle}>
                  Partagez ces informations aux membres pour qu'ils puissent rejoindre votre espace.
                </Text>

                {/* Code */}
                <View style={styles.resultBox}>
                  <Text style={styles.resultLabel}>Code du groupe</Text>
                  <Pressable
                    style={styles.resultRow}
                    onPress={() => Share.share({ message: createResult.codeUnique })}
                  >
                    <Text style={styles.resultValue}>{createResult.codeUnique}</Text>
                    <Ionicons name="copy-outline" size={16} color={Colors.textSecondary} />
                  </Pressable>
                </View>

                {/* API Key */}
                <View style={styles.resultBox}>
                  <Text style={styles.resultLabel}>Votre clé API (admin)</Text>
                  <Pressable
                    style={styles.resultRow}
                    onPress={() => Share.share({ message: createResult.apiKey })}
                  >
                    <Text style={[styles.resultValue, styles.resultKey]}>{createResult.apiKey}</Text>
                    <Ionicons name="copy-outline" size={16} color={Colors.textSecondary} />
                  </Pressable>
                  <Text style={styles.resultHint}>Conservez cette clé précieusement.</Text>
                </View>

                <Button
                  label="Accéder à mon espace"
                  onPress={handleCreateAccess}
                  loading={loading}
                  style={styles.btn}
                />
              </View>
            )}
          </Animated.View>

          {/* Step indicator */}
          <Animated.View entering={FadeIn.delay(400)} style={styles.stepIndicator}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <View
                key={i}
                style={[styles.stepDot, i === currentStepNum - 1 && styles.stepDotActive]}
              />
            ))}
          </Animated.View>

          <Text style={styles.madeby}>
            Made by Alexis Katel &amp; Calyte Espoir
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  madeby: {
    flex: 1,
    textAlign: 'center',
    paddingTop: 30,
    fontSize: 10,
    color: 'gray',
  },
  kav: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: 40,
    paddingBottom: 32,
    justifyContent: 'center',
  },

  // Logo
  logoArea: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  logoText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  appTagline: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  stepSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 24,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  btn: {
    width: '100%',
  },

  // Back
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  backLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },

  // Team badge
  teamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: Colors.surfaceAlt,
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  teamDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  teamName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },

  // Create group link
  createLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
    paddingVertical: 8,
  },
  createLinkText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },

  // Success icon
  successIcon: {
    alignItems: 'center',
    marginBottom: 12,
  },

  // Result boxes
  resultBox: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resultLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: 1,
  },
  resultKey: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  resultHint: {
    fontSize: 11,
    color: Colors.textDisabled,
    marginTop: 4,
  },

  // Step indicator
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
  },
  stepDotActive: {
    width: 20,
    backgroundColor: Colors.primary,
  },
});
