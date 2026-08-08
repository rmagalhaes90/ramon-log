import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { tokens } from '@/theme/tokens';

export function FeatureScreen({
  title,
  eyebrow,
  children,
}: PropsWithChildren<{ title: string; eyebrow: string }>) {
  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {children}
    </ScrollView>
  );
}

export function StateMessage({ children, error = false }: PropsWithChildren<{ error?: boolean }>) {
  return <Text style={[styles.state, error && styles.error]}>{children}</Text>;
}

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

export const featureStyles = StyleSheet.create({
  cardTitle: { color: tokens.colors.text, fontSize: 18, fontWeight: '800' },
  value: { color: tokens.colors.text, fontSize: 16, fontWeight: '700' },
  muted: { color: tokens.colors.muted, lineHeight: 21 },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  divider: {
    borderBottomColor: tokens.colors.border,
    borderBottomWidth: 1,
    paddingVertical: tokens.spacing.sm,
  },
});

const styles = StyleSheet.create({
  screen: { backgroundColor: tokens.colors.background },
  content: {
    gap: tokens.spacing.md,
    padding: tokens.spacing.lg,
    paddingBottom: 120,
    paddingTop: 60,
  },
  eyebrow: { color: tokens.colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  title: {
    color: tokens.colors.text,
    fontSize: 32,
    fontWeight: '900',
    marginBottom: tokens.spacing.sm,
  },
  state: { color: tokens.colors.muted, paddingVertical: tokens.spacing.lg, textAlign: 'center' },
  error: { color: tokens.colors.danger },
  card: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
  },
});
