import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import Storage from 'expo-sqlite/kv-store';

import { useAuth } from '@/src/contexts/AuthContext';
import { useSync } from '@/src/contexts/SyncContext';
import { AppHeader } from '@/src/components/shared/AppHeader';
import { Colors } from '@/src/constants/colors';
import { Layout } from '@/src/constants/layout';

// ─── Section item ─────────────────────────────────────────────────────────────

function SettingRow({
  icon,
  label,
  value,
  onPress,
  danger,
  right,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && onPress && styles.rowPressed]}
    >
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <Ionicons name={icon as any} size={18} color={danger ? Colors.error : Colors.primary} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, danger && { color: Colors.error }]}>{label}</Text>
        {value ? <Text style={styles.rowValue} numberOfLines={1}>{value}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={16} color={Colors.textDisabled} /> : null)}
    </Pressable>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { user, team, signOut } = useAuth();
  const { isSyncing, lastSyncAt, sync } = useSync();
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSyncingManual, setIsSyncingManual] = useState(false);

  const apiKey = Storage.getItemSync('api_key') ?? '—';
  const maskedKey = apiKey !== '—' ? apiKey.slice(0, 3) + '•'.repeat(apiKey.length - 3) : '—';

  const lastSyncLabel = lastSyncAt
    ? lastSyncAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Jamais';

  const handleSync = async () => {
    setIsSyncingManual(true);
    await sync();
    setIsSyncingManual(false);
  };

  const handleSignOut = () => {
    Alert.alert(
      'Se déconnecter',
      'Vous serez redirigé vers l\'écran de connexion. Les données locales seront conservées.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Se déconnecter', style: 'destructive', onPress: signOut },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      <AppHeader />

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Avatar / Identité */}
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>
              {user?.prenom?.[0] ?? user?.nom?.[0] ?? '?'}
            </Text>
          </View>
          <View>
            <Text style={styles.identityName}>
              {user?.prenom ? `${user.prenom} ${user.nom}` : user?.nom ?? '—'}
            </Text>
            {user?.email ? <Text style={styles.identityEmail}>{user.email}</Text> : null}
          </View>
        </View>

        {/* Compte */}
        <SectionHeader title="Compte" />
        <View style={styles.section}>
          <SettingRow
            icon="people-outline"
            label="Espace de travail"
            value={team?.nom ?? '—'}
          />
          <SettingRow
            icon="key-outline"
            label="Clé API"
            value={showApiKey ? apiKey : maskedKey}
            onPress={() => setShowApiKey((v) => !v)}
            right={
              <Ionicons
                name={showApiKey ? 'eye-off-outline' : 'eye-outline'}
                size={16}
                color={Colors.textDisabled}
              />
            }
          />
        </View>

        {/* Synchronisation */}
        <SectionHeader title="Synchronisation" />
        <View style={styles.section}>
          <SettingRow
            icon="time-outline"
            label="Dernière sync"
            value={lastSyncLabel}
          />
          <SettingRow
            icon={isSyncing || isSyncingManual ? 'sync-outline' : 'refresh-outline'}
            label="Synchroniser maintenant"
            onPress={isSyncing || isSyncingManual ? undefined : handleSync}
            right={
              isSyncing || isSyncingManual
                ? <ActivityIndicator size="small" color={Colors.primary} />
                : <Ionicons name="chevron-forward" size={16} color={Colors.textDisabled} />
            }
          />
        </View>

        {/* À propos */}
        <SectionHeader title="Application" />
        <View style={styles.section}>
          <SettingRow
            icon="information-circle-outline"
            label="Version"
            value="1.0.0"
          />
        </View>

        {/* Déconnexion */}
        <SectionHeader title="" />
        <View style={styles.section}>
          <SettingRow
            icon="log-out-outline"
            label="Se déconnecter"
            onPress={handleSignOut}
            danger
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -0.5,
  },

  // Identity card
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: Layout.screenPaddingH,
    marginBottom: 20,
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 20, fontWeight: '700', color: '#fff' },
  identityName: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  identityEmail: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

  // Sections
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textDisabled,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: 16,
    paddingBottom: 6,
  },
  section: {
    marginHorizontal: Layout.screenPaddingH,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  rowPressed: { backgroundColor: Colors.surfaceAlt },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconDanger: { backgroundColor: Colors.error + '14' },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: '500', color: Colors.textPrimary },
  rowValue: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
});
