import { useEffect } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { useSync } from '@/src/contexts/SyncContext';
import { Colors } from '@/src/constants/colors';

export function SyncTabButton() {
  const { sync, isSyncing } = useSync();
  const rotation = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  useEffect(() => {
    if (isSyncing) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 900, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      cancelAnimation(rotation);
      rotation.value = withTiming(0, { duration: 200 });
    }
  }, [isSyncing]);

  return (
    <Pressable
      onPress={sync}
      style={styles.container}
      accessibilityLabel="Synchroniser"
    >
      <Animated.View style={[styles.inner, animStyle]}>
        <Ionicons
          name="sync-outline"
          size={24}
          color={isSyncing ? Colors.primary : Colors.tabInactive}
        />
      </Animated.View>
      <Text style={[styles.label, isSyncing && styles.labelActive]}>
        Sync
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  inner: {
    alignItems: 'center',
    gap: 3,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.tabInactive,
    marginTop: 3,
  },
  labelActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
