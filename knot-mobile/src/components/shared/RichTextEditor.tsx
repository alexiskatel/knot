import { useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  ScrollView,
  Pressable,
  Text,
  StyleSheet,
} from 'react-native';
import { Colors } from '@/src/constants/colors';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function wrapSelection(
  text: string,
  sel: { start: number; end: number },
  before: string,
  after: string,
  placeholder: string,
): { newText: string; cursor: number } {
  const selected = text.slice(sel.start, sel.end);
  const inner = selected || placeholder;
  const newText = text.slice(0, sel.start) + before + inner + after + text.slice(sel.end);
  return { newText, cursor: sel.start + before.length + inner.length + after.length };
}

function prefixLine(
  text: string,
  sel: { start: number; end: number },
  prefix: string,
): { newText: string; cursor: number } {
  let lineStart = sel.start;
  while (lineStart > 0 && text[lineStart - 1] !== '\n') lineStart--;
  const newText = text.slice(0, lineStart) + prefix + text.slice(lineStart);
  return { newText, cursor: sel.start + prefix.length };
}

// ─── Toolbar button ───────────────────────────────────────────────────────────

function Btn({
  label,
  onPress,
  mono,
}: {
  label: string;
  onPress: () => void;
  mono?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
    >
      <Text style={[styles.btnLabel, mono && styles.btnMono]}>{label}</Text>
    </Pressable>
  );
}

function Sep() {
  return <View style={styles.sep} />;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RichTextEditor({ value, onChange, placeholder, minHeight = 120 }: Props) {
  const inputRef = useRef<TextInput>(null);
  const selRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  const apply = useCallback(
    (newText: string, cursor: number) => {
      onChange(newText);
      // Restore focus + cursor after state update
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.setNativeProps({ selection: { start: cursor, end: cursor } });
      });
    },
    [onChange],
  );

  const bold = useCallback(() => {
    const { newText, cursor } = wrapSelection(value, selRef.current, '**', '**', 'texte gras');
    apply(newText, cursor);
  }, [value, apply]);

  const italic = useCallback(() => {
    const { newText, cursor } = wrapSelection(value, selRef.current, '_', '_', 'texte italique');
    apply(newText, cursor);
  }, [value, apply]);

  const code = useCallback(() => {
    const { newText, cursor } = wrapSelection(value, selRef.current, '`', '`', 'code');
    apply(newText, cursor);
  }, [value, apply]);

  const h1 = useCallback(() => {
    const { newText, cursor } = prefixLine(value, selRef.current, '# ');
    apply(newText, cursor);
  }, [value, apply]);

  const h2 = useCallback(() => {
    const { newText, cursor } = prefixLine(value, selRef.current, '## ');
    apply(newText, cursor);
  }, [value, apply]);

  const bullet = useCallback(() => {
    const { newText, cursor } = prefixLine(value, selRef.current, '- ');
    apply(newText, cursor);
  }, [value, apply]);

  const numbered = useCallback(() => {
    const { newText, cursor } = prefixLine(value, selRef.current, '1. ');
    apply(newText, cursor);
  }, [value, apply]);

  const separator = useCallback(() => {
    const pos = selRef.current.end;
    const ins = '\n---\n';
    const newText = value.slice(0, pos) + ins + value.slice(pos);
    apply(newText, pos + ins.length);
  }, [value, apply]);

  return (
    <View style={styles.container}>
      {/* Toolbar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.toolbar}
        contentContainerStyle={styles.toolbarContent}
        keyboardShouldPersistTaps="always"
      >
        <Btn label="G" onPress={bold} mono />
        <Btn label="I" onPress={italic} mono />
        <Btn label="<>" onPress={code} mono />
        <Sep />
        <Btn label="H1" onPress={h1} />
        <Btn label="H2" onPress={h2} />
        <Sep />
        <Btn label="•" onPress={bullet} />
        <Btn label="1." onPress={numbered} />
        <Sep />
        <Btn label="—" onPress={separator} />
      </ScrollView>

      {/* Input */}
      <TextInput
        ref={inputRef}
        style={[styles.input, { minHeight }]}
        value={value}
        onChangeText={onChange}
        onSelectionChange={({ nativeEvent }) => { selRef.current = nativeEvent.selection; }}
        placeholder={placeholder ?? 'Commencez à écrire…'}
        placeholderTextColor={Colors.textDisabled}
        multiline
        textAlignVertical="top"
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  toolbar: {
    backgroundColor: Colors.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexGrow: 0,
  },
  toolbarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 2,
  },
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: { backgroundColor: Colors.border },
  btnLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  btnMono: { fontFamily: 'monospace' },
  sep: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border,
    marginHorizontal: 4,
  },
  input: {
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 22,
    padding: 12,
  },
});
