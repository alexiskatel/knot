import { Ionicons } from '@expo/vector-icons';
import Storage from 'expo-sqlite/kv-store';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSQLiteContext } from 'expo-sqlite';

import { AppHeader } from '@/src/components/shared/AppHeader';
import { Colors } from '@/src/constants/colors';
import { Layout } from '@/src/constants/layout';
import { useAuth, type Account } from '@/src/contexts/AuthContext';
import { useSync } from '@/src/contexts/SyncContext';
import { migrateDbIfNeeded } from '@/src/db/migrations';
import { sendLocalNotification } from '@/src/services/pushNotifications';
import { createNotification } from '@/src/db/notifications';
import AddAccountModal from '@/src/components/settings/AddAccountModal';

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

// ─── Account card ─────────────────────────────────────────────────────────────

function AccountCard({
  account,
  isActive,
  onPress,
  onRemove,
}: {
  account: Account;
  isActive: boolean;
  onPress: () => void;
  onRemove: () => void;
}) {
  const color = account.team.couleur_primaire ?? Colors.primary;
  const initial = account.user.prenom?.[0] ?? account.user.nom?.[0] ?? '?';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.accountCard,
        isActive && { borderColor: color, borderWidth: 2 },
        pressed && styles.rowPressed,
      ]}
    >
      <View style={[styles.accountAvatar, { backgroundColor: color }]}>
        <Text style={styles.accountAvatarText}>{initial.toUpperCase()}</Text>
      </View>
      <View style={styles.accountInfo}>
        <Text style={styles.accountTeam} numberOfLines={1}>{account.team.nom}</Text>
        <Text style={styles.accountUser} numberOfLines={1}>
          {account.user.prenom ? `${account.user.prenom} ${account.user.nom}` : account.user.nom}
        </Text>
      </View>
      <View style={styles.accountRight}>
        {isActive && <Ionicons name="checkmark-circle" size={20} color={color} />}
        {!isActive && (
          <Pressable onPress={onRemove} hitSlop={8}>
            <Ionicons name="close-circle-outline" size={20} color={Colors.textDisabled} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { user, team, accounts, activeIdx, signOut, switchAccount, removeAccount } = useAuth();
  const { isSyncing, lastSyncAt, sync, bumpSyncVersion } = useSync();
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSyncingManual, setIsSyncingManual] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);

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
      'Tous vos comptes seront déconnectés. Les données locales seront conservées.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Se déconnecter', style: 'destructive', onPress: signOut },
      ],
    );
  };

  const handleRemoveAccount = (idx: number) => {
    const acc = accounts[idx];
    Alert.alert(
      'Supprimer ce compte',
      `Retirer "${acc.team.nom}" de la liste ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => removeAccount(idx) },
      ],
    );
  };

  const handleResetDb = () => {
    Alert.alert(
      'Vider la base de données',
      'Toutes vos données locales (notes, tâches, projets) seront supprimées. Vous serez renvoyé à la page de connexion.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Vider et reconnecter',
          style: 'destructive',
          onPress: async () => {
            setIsResetting(true);
            try {
              await db.execAsync(`
                DROP TABLE IF EXISTS reactions;
                DROP TABLE IF EXISTS commentaires;
                DROP TABLE IF EXISTS liaisons;
                DROP TABLE IF EXISTS notes;
                DROP TABLE IF EXISTS taches;
                DROP TABLE IF EXISTS projets;
                DROP TABLE IF EXISTS users;
                DROP TABLE IF EXISTS teams;
                DROP TABLE IF EXISTS notifications;
                PRAGMA user_version = 0;
              `);
              await migrateDbIfNeeded(db);
              Storage.removeItemSync('api_key');
              Storage.removeItemSync('team_id');
              Storage.removeItemSync('user');
              Storage.removeItemSync('team');
              Storage.removeItemSync('accounts');
              Storage.removeItemSync('active_idx');
              Storage.removeItemSync('last_sync');
              await signOut();
            } catch (e) {
              console.error('[Reset DB]', e);
              Alert.alert('Erreur', 'Impossible de vider la base. Réessayez.');
            } finally {
              setIsResetting(false);
            }
          },
        },
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

        {/* ── Mes groupes ── */}
        {accounts.length > 0 && (
          <>
            <SectionHeader title="Mes groupes" />
            <View style={[styles.section, { padding: 8, gap: 6 }]}>
              {accounts.map((acc, idx) => (
                <AccountCard
                  key={`${acc.team_id}-${acc.user.id}`}
                  account={acc}
                  isActive={idx === activeIdx}
                  onPress={() => idx !== activeIdx && switchAccount(idx)}
                  onRemove={() => handleRemoveAccount(idx)}
                />
              ))}
              <Pressable
                onPress={() => setShowAddAccount(true)}
                style={({ pressed }) => [styles.addAccountBtn, pressed && styles.rowPressed]}
              >
                <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
                <Text style={styles.addAccountLabel}>Ajouter un groupe</Text>
              </Pressable>
            </View>
          </>
        )}

        {/* ── Admin : gestion membres ── */}
        {user?.is_admin && (
          <>
            <SectionHeader title="Administration" />
            <View style={styles.section}>
              <SettingRow
                icon="people-outline"
                label="Gérer les membres"
                onPress={() => router.push('/(app)/members')}
              />
            </View>
          </>
        )}

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

        {/* Données locales */}
        <SectionHeader title="Données" />
        <View style={styles.section}>
          <SettingRow
            icon="trash-outline"
            label="Vider la base de données locale"
            onPress={isResetting ? undefined : handleResetDb}
            danger
            right={
              isResetting
                ? <ActivityIndicator size="small" color={Colors.error} />
                : <Ionicons name="chevron-forward" size={16} color={Colors.textDisabled} />
            }
          />
        </View>

        <Text style={styles.madeby}>
          Made by Alexis Katel &amp; Calyte Espoir
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal ajouter un groupe */}
      <AddAccountModal
        visible={showAddAccount}
        onClose={() => setShowAddAccount(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  madeby: {
    flex: 1,
    textAlign: 'center',
    paddingTop: 30,
    fontSize: 10,
    color: 'gray',
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

  // Account cards
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  accountAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountAvatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  accountInfo: { flex: 1 },
  accountTeam: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  accountUser: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  accountRight: { alignItems: 'center', justifyContent: 'center' },

  // Add account button
  addAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
  },
  addAccountLabel: { fontSize: 14, color: Colors.primary, fontWeight: '500' },
});
