import { forwardRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, type GestureResponderEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import type { TabTriggerSlotProps } from 'expo-router/ui';
import { Colors } from '@/src/constants/colors';

interface TabButtonProps extends TabTriggerSlotProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
  label: string;
}

const AnimatedView = Animated.createAnimatedComponent(View);

export const TabButton = forwardRef<View, TabButtonProps>(
  ({ icon, iconFocused, label, isFocused, onPress, onLongPress }, ref) => {
    const scale = useSharedValue(1);
    const active = useSharedValue(isFocused ? 1 : 0);

    useEffect(() => {
      active.value = withTiming(isFocused ? 1 : 0, { duration: 200 });
    }, [isFocused]);

    const iconStyle = useAnimatedStyle(() => ({
      transform: [
        {
          scale: interpolate(active.value, [0, 1], [1, 1.1]),
        },
      ],
    }));

    const dotStyle = useAnimatedStyle(() => ({
      opacity: active.value,
      transform: [{ scaleX: active.value }],
    }));

    function handlePress(e: GestureResponderEvent) {
      scale.value = withSpring(0.88, { damping: 20, stiffness: 400 }, () => {
        scale.value = withSpring(1, { damping: 20, stiffness: 400 });
      });
      onPress?.(e);
    }

    return (
      <Pressable
        ref={ref}
        onPress={handlePress}
        onLongPress={onLongPress}
        style={styles.container}
        accessibilityRole="tab"
        accessibilityState={{ selected: isFocused }}
      >
        <AnimatedView style={[styles.inner, iconStyle]}>
          <Ionicons
            name={isFocused ? iconFocused : icon}
            size={24}
            color={isFocused ? Colors.tabActive : Colors.tabInactive}
          />
          <Text style={[styles.label, isFocused && styles.labelActive]}>
            {label}
          </Text>
        </AnimatedView>

        <AnimatedView style={[styles.dot, dotStyle]} />
      </Pressable>
    );
  },
);

TabButton.displayName = 'TabButton';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    position: 'relative',
  },
  inner: {
    alignItems: 'center',
    gap: 3,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.tabInactive,
  },
  labelActive: {
    color: Colors.tabActive,
    fontWeight: '600',
  },
  dot: {
    position: 'absolute',
    top: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.tabActive,
  },
});
