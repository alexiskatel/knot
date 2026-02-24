import { Colors } from '@/src/constants/colors';
import { Layout } from '@/src/constants/layout';
import { useAuth } from '@/src/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SyncTabButton } from '@/src/components/navigation/SyncTabButton';

export function AppHeader() {
  const router = useRouter();
  const { team } = useAuth();

  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.headerTitle}>knot</Text>
        {team && <Text style={styles.headerTeam}>{team.nom}</Text>}
      </View>
        
      <View
        style={styles.headerAction}
      >
        <SyncTabButton />
      </View>
      {/* <Pressable
        style={styles.headerAction}
        onPress={() => router.push('/(app)/settings')}
      >
        <Ionicons name="settings-outline" size={20} color={Colors.textPrimary} />
      </Pressable> */}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.screenPaddingH,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  headerTeam: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
