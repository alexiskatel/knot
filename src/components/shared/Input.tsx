import { useState } from 'react';
import { TextInput, Text, View, Pressable, StyleSheet, type KeyboardTypeOptions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/src/constants/colors';
import { Layout } from '@/src/constants/layout';

interface InputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  error?: string;
  editable?: boolean;
  autoFocus?: boolean;
  returnKeyType?: 'done' | 'next' | 'search' | 'go';
  onSubmitEditing?: () => void;
  maxLength?: number;
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'none',
  error,
  editable = true,
  autoFocus,
  returnKeyType,
  onSubmitEditing,
  maxLength,
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const borderAnim = useSharedValue(0);

  const animatedBorder = useAnimatedStyle(() => ({
    borderColor: withTiming(
      error ? Colors.error : borderAnim.value === 1 ? Colors.primary : Colors.border,
      { duration: 150 },
    ),
  }));

  function handleFocus() {
    setIsFocused(true);
    borderAnim.value = 1;
  }

  function handleBlur() {
    setIsFocused(false);
    borderAnim.value = 0;
  }

  const showToggle = secureTextEntry;

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}

      <Animated.View style={[styles.container, animatedBorder, !editable && styles.disabled]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textDisabled}
          secureTextEntry={showToggle && !isVisible}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={editable}
          autoFocus={autoFocus}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={handleFocus}
          onBlur={handleBlur}
          maxLength={maxLength}
        />
        {showToggle && (
          <Pressable onPress={() => setIsVisible((v) => !v)} style={styles.toggle}>
            <Ionicons
              name={isVisible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={Colors.textSecondary}
            />
          </Pressable>
        )}
      </Animated.View>

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  container: {
    height: Layout.inputHeight,
    borderRadius: Layout.inputRadius,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  disabled: {
    backgroundColor: Colors.surfaceAlt,
    opacity: 0.7,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.textPrimary,
    height: '100%',
  },
  toggle: {
    padding: 4,
    marginLeft: 8,
  },
  error: {
    fontSize: 12,
    color: Colors.error,
    marginTop: 2,
  },
});
