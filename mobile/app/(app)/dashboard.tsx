import { dashboardSummary, type DashboardSummary } from '@kyro/domain';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { useAuth } from '@/auth/AuthProvider';
import { loadUserData } from '@/services/user-data';
import { tokens } from '@/theme/tokens';

const weightsSchema = z.array(z.object({ d: z.string(), kg: z.number() })).max(5000);
const sessionsSchema = z.array(z.object({ date: z.string(), volume: z.number() })).max(450);
const readinessSchema = z.record(z.string(), z.object({ score: z.number() }));
const nutritionSchema = z.record(
  z.string(),
  z.object({ kcal: z.number(), protein: z.number(), water: z.number() }),
);

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    void Promise.all([
      loadUserData(user.uid, 'bodyWeights', weightsSchema),
      loadUserData(user.uid, 'sessionLog', sessionsSchema),
      loadUserData(user.uid, 'readinessLog', readinessSchema),
      loadUserData(user.uid, 'nutritionLog', nutritionSchema),
    ])
      .then(([weights, sessions, readiness, nutrition]) =>
        setData(dashboardSummary(weights, sessions, readiness, nutrition)),
      )
      .catch(() => setError('Não foi possível carregar o dashboard. Verifique sua conexão.'));
  }, [user]);

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>VISÃO DE HOJE</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Olá, {user?.displayName ?? user?.email?.split('@')[0] ?? 'atleta'}
          </Text>
        </View>
        <Pressable onPress={() => void logout()}>
          <Text style={styles.logout}>Sair</Text>
        </Pressable>
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {!data && !error ? <ActivityIndicator color={tokens.colors.primary} size="large" /> : null}
      {data ? (
        <>
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>Readiness</Text>
            <Text style={styles.heroValue}>
              {data.readiness === null ? '—' : Math.round(data.readiness)}
            </Text>
            <Text style={styles.heroHint}>Pontuação registrada hoje</Text>
          </View>
          <View style={styles.grid}>
            <Metric
              label="Peso atual"
              value={data.weight === null ? '—' : `${data.weight.toFixed(1)} kg`}
            />
            <Metric label="Treinos em 7 dias" value={String(data.weeklySessions)} />
            <Metric
              label="Volume semanal"
              value={`${Math.round(data.weeklyVolume).toLocaleString('pt')} kg`}
            />
            <Metric label="Calorias hoje" value={`${Math.round(data.calories)} kcal`} />
            <Metric label="Proteína hoje" value={`${Math.round(data.protein)} g`} />
            <Metric label="Água hoje" value={`${data.water.toFixed(1)} L`} />
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: tokens.colors.background },
  content: { gap: tokens.spacing.lg, padding: tokens.spacing.lg, paddingTop: 64 },
  header: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  eyebrow: { color: tokens.colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  title: {
    color: tokens.colors.text,
    fontSize: 28,
    fontWeight: '800',
    marginTop: tokens.spacing.xs,
  },
  logout: { color: tokens.colors.muted, padding: tokens.spacing.sm },
  error: { color: tokens.colors.danger },
  hero: {
    backgroundColor: tokens.colors.primary,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
  },
  heroLabel: { color: tokens.colors.primaryText, fontSize: 14, fontWeight: '700' },
  heroValue: { color: tokens.colors.primaryText, fontSize: 58, fontWeight: '900' },
  heroHint: { color: tokens.colors.primaryText, opacity: 0.75 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.md },
  metric: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    minWidth: '45%',
    padding: tokens.spacing.md,
  },
  metricValue: { color: tokens.colors.text, fontSize: 20, fontWeight: '800' },
  metricLabel: { color: tokens.colors.muted, fontSize: 13, marginTop: tokens.spacing.xs },
});
