import { estimatedOneRepMax } from '@kyro/domain';
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { tokens } from '@/theme/tokens';

export default function HomeScreen() {
  return (
    <Screen>
      <View style={styles.hero}>
        <Text accessibilityRole="header" style={styles.eyebrow}>
          KYRO MOBILE
        </Text>
        <Text style={styles.title}>Sua evolução, em qualquer lugar.</Text>
        <Text style={styles.body}>
          Fundação nativa conectada ao mesmo domínio seguro do KYRO Web.
        </Text>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{estimatedOneRepMax(100, 10).toFixed(1)} kg</Text>
          <Text style={styles.metricLabel}>estimativa de 1RM compartilhada</Text>
        </View>
        <Link href="/login" style={styles.action}>
          Entrar no KYRO
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, justifyContent: 'center', gap: tokens.spacing.md },
  eyebrow: { color: tokens.colors.primary, fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  title: { color: tokens.colors.text, fontSize: 40, fontWeight: '800', lineHeight: 44 },
  body: { color: tokens.colors.muted, fontSize: 17, lineHeight: 25 },
  metric: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    padding: tokens.spacing.lg,
  },
  metricValue: { color: tokens.colors.text, fontSize: 28, fontWeight: '800' },
  metricLabel: { color: tokens.colors.muted, marginTop: tokens.spacing.xs },
  action: {
    backgroundColor: tokens.colors.primary,
    borderRadius: tokens.radius.pill,
    color: tokens.colors.primaryText,
    fontSize: 16,
    fontWeight: '800',
    marginTop: tokens.spacing.sm,
    overflow: 'hidden',
    padding: tokens.spacing.md,
    textAlign: 'center',
  },
});
