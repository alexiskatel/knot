import { View, Text, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { Colors } from '@/src/constants/colors';

// ─── Inline parser ────────────────────────────────────────────────────────────
// Handles **bold**, *italic*, _italic_, `code` within a single text run.

interface InlinePart {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const re = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(_([^_]+)_)|(`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    if (m[1])      parts.push({ text: m[2], bold: true });
    else if (m[3]) parts.push({ text: m[4], italic: true });
    else if (m[5]) parts.push({ text: m[6], italic: true });
    else if (m[7]) parts.push({ text: m[8], code: true });
    last = re.lastIndex;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

function InlineLine({ parts, baseStyle }: { parts: InlinePart[]; baseStyle?: TextStyle }) {
  if (parts.length === 1 && !parts[0].bold && !parts[0].italic && !parts[0].code) {
    return <Text style={baseStyle} selectable>{parts[0].text}</Text>;
  }
  return (
    <Text style={baseStyle} selectable>
      {parts.map((p, i) => {
        const s: TextStyle[] = [];
        if (p.bold)   s.push({ fontWeight: '700' });
        if (p.italic) s.push({ fontStyle: 'italic' });
        if (p.code)   s.push(styles.inlineCode);
        return <Text key={i} style={s}>{p.text}</Text>;
      })}
    </Text>
  );
}

// ─── Block renderer ───────────────────────────────────────────────────────────

interface Props {
  content: string;
  style?: ViewStyle;
}

export function MarkdownView({ content, style }: Props) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    if (line.startsWith('### ')) {
      elements.push(
        <InlineLine key={i} parts={parseInline(line.slice(4))} baseStyle={styles.h3} />,
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <InlineLine key={i} parts={parseInline(line.slice(3))} baseStyle={styles.h2} />,
      );
    } else if (line.startsWith('# ')) {
      elements.push(
        <InlineLine key={i} parts={parseInline(line.slice(2))} baseStyle={styles.h1} />,
      );

    // Separator
    } else if (line === '---') {
      elements.push(<View key={i} style={styles.hr} />);

    // Unordered list
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <View key={i} style={styles.listRow}>
          <Text style={styles.bullet}>•</Text>
          <View style={{ flex: 1 }}>
            <InlineLine parts={parseInline(line.slice(2))} baseStyle={styles.p} />
          </View>
        </View>,
      );

    // Ordered list
    } else if (/^\d+\. /.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1] ?? '';
      const rest = line.replace(/^\d+\. /, '');
      elements.push(
        <View key={i} style={styles.listRow}>
          <Text style={styles.num}>{num}.</Text>
          <View style={{ flex: 1 }}>
            <InlineLine parts={parseInline(rest)} baseStyle={styles.p} />
          </View>
        </View>,
      );

    // Empty line → small spacer
    } else if (line.trim() === '') {
      elements.push(<View key={i} style={styles.spacer} />);

    // Normal paragraph
    } else {
      elements.push(
        <InlineLine key={i} parts={parseInline(line)} baseStyle={styles.p} />,
      );
    }

    i++;
  }

  return <View style={style}>{elements}</View>;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  h1: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 18,
    marginBottom: 6,
    lineHeight: 30,
  },
  h2: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 14,
    marginBottom: 4,
    lineHeight: 26,
  },
  h3: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 10,
    marginBottom: 2,
    lineHeight: 22,
  },
  p: {
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 24,
    marginBottom: 2,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 3,
  },
  bullet: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 24,
    width: 14,
    textAlign: 'center',
  },
  num: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 24,
    width: 20,
    textAlign: 'right',
  },
  hr: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 14,
  },
  spacer: { height: 8 },
  inlineCode: {
    fontFamily: 'monospace',
    fontSize: 13,
    backgroundColor: Colors.surfaceAlt,
    color: Colors.primary,
    paddingHorizontal: 3,
    borderRadius: 3,
  },
});
