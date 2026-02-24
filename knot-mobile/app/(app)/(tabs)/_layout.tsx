import { Tabs, TabList, TabTrigger, TabSlot } from 'expo-router/ui';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabButton } from '@/src/components/navigation/TabButton';
import { Colors } from '@/src/constants/colors';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs>
      <TabSlot />

      <TabList style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TabTrigger name="home" href="/(app)" asChild>
          <TabButton icon="document-text-outline" iconFocused="document-text" label="Notes" />
        </TabTrigger>

        <TabTrigger name="taches" href="/(app)/taches" asChild>
          <TabButton icon="checkmark-circle-outline" iconFocused="checkmark-circle" label="Tâches" />
        </TabTrigger>

        <TabTrigger name="projets" href="/(app)/projets" asChild>
          <TabButton icon="folder-outline" iconFocused="folder" label="Projets" />
        </TabTrigger>

        <TabTrigger name="settings" href="/(app)/settings" asChild>
          <TabButton icon="settings-outline" iconFocused="settings" label="Réglages" />
        </TabTrigger>

        {/* <SyncTabButton /> */}
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 10,
  },
});
