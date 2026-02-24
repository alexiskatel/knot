import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
import { validateApiKey, validateTeamCode } from '@/src/api/auth';
import { Button } from '@/src/components/shared/Button';
import { Input } from '@/src/components/shared/Input';
import { Colors } from '@/src/constants/colors';
import { Layout } from '@/src/constants/layout';
import { useAuth } from '@/src/contexts/AuthContext';

type Step = 'team' | 'key';

export default function AuthScreen() {
  const { signIn } = useAuth();

  const isDev = Constants.expoConfig?.extra?.dev ?? __DEV__;

  const [step, setStep] = useState<Step>('team');
  const [teamCode, setTeamCode] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Step 1: validate team code ──────────────────────────────────────────
  async function handleValidateCode() {
    const code = teamCode.trim().toUpperCase();
    if (!code) {
      setError('Veuillez saisir votre code team.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const team = await validateTeamCode(code);
      if (!team) {
        setError('Réponse invalide du serveur.');
        return;
      }
      setTeamInfo(team);
      setStep('key');
    } catch (e: any) {
      setError(e.message ?? 'Code invalide. Vérifiez et réessayez.');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: validate API key ─────────────────────────────────────────────
  async function handleValidateKey() {
    const key = apiKey.trim();
    if (!key || !teamInfo) return;
    setError('');
    setLoading(true);
    try {
      const { user, team } = await validateApiKey(key, teamInfo.id);
      await signIn(key, user, team);
    } catch (e: any) {
      console.log(e);
      
      setError(e.message ?? 'Clé invalide. Vérifiez et réessayez.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoAccess() {
    await signIn('demo-key-000', {
      id: 1, nom: 'Demo', prenom: 'User', email: 'demo@knot.app',
    }, {
      id: 1, nom: 'Team Démo', couleur_primaire: '#2F3C73',
    });
  }

  function handleBackToTeam() {
    setStep('team');
    setApiKey('');
    setTeamInfo(null);
    setError('');
  }

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
              </View>
            )}

            {step === 'key' && teamInfo && (
              <View key="step-key">
                {/* Back button */}
                <Pressable onPress={handleBackToTeam} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={18} color={Colors.textSecondary} />
                  <Text style={styles.backLabel}>Changer de team</Text>
                </Pressable>

                {/* Team badge */}
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
          </Animated.View>

          {/* Dev bypass */}
          {/* {isDev && (
            <Animated.View entering={FadeIn.delay(500)} style={styles.devArea}>
              <Pressable onPress={handleDemoAccess} style={styles.devBtn}>
                <Text style={styles.devLabel}>⚡ Accès démo (dev)</Text>
              </Pressable>
            </Animated.View>
          )} */}

          {/* Step indicator */}
          <Animated.View entering={FadeIn.delay(400)} style={styles.stepIndicator}>
            <View style={[styles.stepDot, step === 'team' && styles.stepDotActive]} />
            <View style={[styles.stepDot, step === 'key' && styles.stepDotActive]} />
          </Animated.View>
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

  // Dev
  devArea: {
    alignItems: 'center',
    marginTop: 24,
  },
  devBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  devLabel: {
    fontSize: 13,
    color: Colors.textDisabled,
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
