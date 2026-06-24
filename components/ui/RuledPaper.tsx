import React, { useState } from 'react';
import { View, Text, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors, Spacing, FontSize, FontWeight } from '@/constants/design';

// Estética de folha de caderno — vale nos dois temas (é a metáfora "papel físico":
// o papel creme se destaca tanto no dark quanto no light).
export const PAPER_BG = '#FBF7EA';                  // creme
const RULE_COLOR = 'rgba(60,100,150,0.18)';         // pauta azulada
const MARGIN_COLOR = 'rgba(214,90,90,0.45)';        // margem vermelha
export const NOTE_INK = '#3A3550';                  // "tinta"
export const NOTE_INK_FADED = 'rgba(58,53,80,0.38)';// placeholder
export const NOTE_FONT = 'Caveat_400Regular';       // manuscrita
export const NOTE_FONT_SIZE = 23;                   // Caveat é grande/aberta
export const NOTE_LINE_HEIGHT = 34;                 // espaçamento das pautas

const TOP_PAD = 14;
const MARGIN_X = 42;

/**
 * Folha de caderno pautada. Desenha as pautas horizontais (calculadas pela altura
 * real via onLayout) + a margem vermelha, e põe o conteúdo (Text/TextInput) por cima
 * com `lineHeight = NOTE_LINE_HEIGHT` pra o texto cair sobre as linhas.
 */
export function RuledPaper({
  children,
  style,
  minHeight = NOTE_LINE_HEIGHT * 3 + TOP_PAD,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  minHeight?: number;
}) {
  const [height, setHeight] = useState(minHeight);
  const lineCount = Math.max(1, Math.floor((height - TOP_PAD) / NOTE_LINE_HEIGHT));

  return (
    <View
      style={[styles.paper, { minHeight }, style]}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {Array.from({ length: lineCount }).map((_, i) => (
          <View key={i} style={[styles.rule, { top: TOP_PAD + (i + 1) * NOTE_LINE_HEIGHT }]} />
        ))}
      </View>
      <View style={styles.margin} pointerEvents="none" />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

/** Anotação só-leitura, escrita "à mão" na folha pautada. */
export function NotebookNote({ text, style }: { text: string; style?: StyleProp<ViewStyle> }) {
  return (
    <RuledPaper style={style}>
      <Text style={styles.handwriting}>{text}</Text>
    </RuledPaper>
  );
}

/**
 * Seção de anotações pronta pra usar na tela do item: um cabeçalho discreto +
 * a folha de caderno (com a anotação manuscrita) OU um convite a escrever.
 * É só visual — quem dá o tap-pra-editar é o Pressable que já envolve a seção.
 */
export function NotesSection({ notes }: { notes?: string | null }) {
  const scheme = useColorScheme() ?? 'dark';
  const colors = AppColors[scheme];
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Ionicons name="reader-outline" size={15} color={colors.primary} />
        <Text style={[styles.headerText, { color: colors.textSecondary }]}>Minhas anotações</Text>
        <Ionicons name="create-outline" size={16} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
      </View>
      {notes ? (
        <NotebookNote text={notes} />
      ) : (
        <RuledPaper minHeight={NOTE_LINE_HEIGHT * 2 + TOP_PAD}>
          <Text style={[styles.handwriting, { color: NOTE_INK_FADED }]}>
            Toque para escrever suas anotações da aula…
          </Text>
        </RuledPaper>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  paper: {
    backgroundColor: PAPER_BG,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  content: {
    paddingTop: TOP_PAD - 4,
    paddingBottom: 10,
    paddingLeft: MARGIN_X + 12,
    paddingRight: 18,
  },
  rule: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: RULE_COLOR,
  },
  margin: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: MARGIN_X,
    width: 2,
    backgroundColor: MARGIN_COLOR,
  },
  handwriting: {
    fontFamily: NOTE_FONT,
    fontSize: NOTE_FONT_SIZE,
    lineHeight: NOTE_LINE_HEIGHT,
    color: NOTE_INK,
  },
  section: {
    width: '100%',
    marginTop: Spacing['2xl'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  headerText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
