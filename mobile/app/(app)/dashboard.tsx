import {
  dashboardSummary,
  dateKey,
  readinessClass,
  readinessScore,
  type DashboardSummary,
} from '@kyro/domain';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { useAuth } from '@/auth/AuthProvider';
import { loadUserData, saveUserData, SyncConflictError } from '@/services/user-data';
import { tokens } from '@/theme/tokens';

const weightsSchema = z.array(z.object({ d: z.string(), kg: z.number() })).max(5000);
const sessionsSchema = z
  .array(z.object({ date: z.string(), volume: z.number() }).passthrough())
  .max(450);
const readinessEntrySchema = z
  .object({
    sleep: z.number().int().min(1).max(5),
    energy: z.number().int().min(1).max(5),
    soreness: z.number().int().min(1).max(5),
    stress: z.number().int().min(1).max(5),
    score: z.number().min(0).max(100),
    classification: z.string(),
    recordedAt: z.iso.datetime(),
  })
  .passthrough();
const readinessSchema = z.record(z.string(), readinessEntrySchema);
const nutritionSchema = z.record(
  z.string(),
  z.object({ kcal: z.number(), protein: z.number(), water: z.number() }).passthrough(),
);
type ReadinessLog = z.infer<typeof readinessSchema>;
type ScaleKey = 'sleep' | 'energy' | 'soreness' | 'stress';

const scaleLabels: Record<ScaleKey, string> = {
  sleep: 'Sono',
  energy: 'Energia',
  soreness: 'Dor muscular',
  stress: 'Estresse',
};
const classificationLabels = {
  high: 'Treino intenso',
  normal: 'Treino normal',
  reduce: 'Reduzir volume',
  light: 'Sessão leve',
  rest: 'Descanso',
};

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [readiness, setReadiness] = useState<ReadinessLog>({});
  const [answers, setAnswers] = useState<Record<ScaleKey, number>>({
    sleep: 3,
    energy: 3,
    soreness: 3,
    stress: 3,
  });
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    if (!user) return;
    void Promise.all([
      loadUserData(user.uid, 'bodyWeights', weightsSchema),
      loadUserData(user.uid, 'sessionLog', sessionsSchema),
      loadUserData(user.uid, 'readinessLog', readinessSchema),
      loadUserData(user.uid, 'nutritionLog', nutritionSchema),
    ])
      .then(([weights, sessions, readinessLog, nutrition]) => {
        const nextReadiness = readinessLog ?? {};
        setReadiness(nextReadiness);
        setData(dashboardSummary(weights, sessions, nextReadiness, nutrition));
        const today = nextReadiness[dateKey()];
        if (today)
          setAnswers({
            sleep: today.sleep,
            energy: today.energy,
            soreness: today.soreness,
            stress: today.stress,
          });
      })
      .catch(() => setError('Não foi possível carregar o dashboard. Verifique sua conexão.'));
  }, [user]);

  async function saveReadiness() {
    if (!user) return;
    const score = readinessScore(answers.sleep, answers.energy, answers.soreness, answers.stress);
    const classification = readinessClass(score);
    const next: ReadinessLog = {
      ...readiness,
      [dateKey()]: {
        ...answers,
        score,
        classification,
        recordedAt: new Date().toISOString(),
      },
    };
    try {
      const result = await saveUserData(user.uid, 'readinessLog', readinessSchema, next);
      setReadiness(next);
      setData((current) => (current ? { ...current, readiness: score } : current));
      setSaveStatus(
        result === 'queued'
          ? 'Salvo no aparelho; sincronização pendente.'
          : 'Readiness sincronizado.',
      );
    } catch (cause) {
      setSaveStatus(
        cause instanceof SyncConflictError
          ? 'O readiness mudou em outro aparelho. Reabra antes de substituir.'
          : 'Não foi possível salvar o readiness.',
      );
    }
  }

  const previewScore = readinessScore(
    answers.sleep,
    answers.energy,
    answers.soreness,
    answers.stress,
  );
  const previewClass = readinessClass(previewScore);
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
          <View style={styles.card}>
            <View style={styles.readinessHeader}>
              <View>
                <Text style={styles.cardTitle}>Check-in diário</Text>
                <Text style={styles.muted}>{classificationLabels[previewClass]}</Text>
              </View>
              <Text style={styles.score}>{previewScore}</Text>
            </View>
            {(Object.keys(scaleLabels) as ScaleKey[]).map((key) => (
              <View key={key} style={styles.scaleRow}>
                <Text style={styles.scaleLabel}>{scaleLabels[key]}</Text>
                <View style={styles.scaleButtons}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Pressable
                      accessibilityLabel={`${scaleLabels[key]} ${value}`}
                      accessibilityState={{ selected: answers[key] === value }}
                      key={value}
                      onPress={() => setAnswers((current) => ({ ...current, [key]: value }))}
                      style={[
                        styles.scaleButton,
                        answers[key] === value && styles.scaleButtonActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.scaleButtonText,
                          answers[key] === value && styles.scaleButtonTextActive,
                        ]}
                      >
                        {value}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
            {saveStatus ? (
              <Text accessibilityLiveRegion="polite" style={styles.muted}>
                {saveStatus}
              </Text>
            ) : null}
            <Pressable onPress={() => void saveReadiness()} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Salvar check-in</Text>
            </Pressable>
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
  content: {
    gap: tokens.spacing.lg,
    padding: tokens.spacing.lg,
    paddingBottom: 120,
    paddingTop: 64,
  },
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
  card: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    gap: tokens.spacing.md,
    padding: tokens.spacing.md,
  },
  readinessHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  cardTitle: { color: tokens.colors.text, fontSize: 18, fontWeight: '800' },
  muted: { color: tokens.colors.muted, lineHeight: 21 },
  score: { color: tokens.colors.primary, fontSize: 34, fontWeight: '900' },
  scaleRow: { gap: tokens.spacing.sm },
  scaleLabel: { color: tokens.colors.text, fontWeight: '700' },
  scaleButtons: { flexDirection: 'row', gap: tokens.spacing.sm },
  scaleButton: {
    alignItems: 'center',
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    flex: 1,
    paddingVertical: tokens.spacing.sm,
  },
  scaleButtonActive: { backgroundColor: tokens.colors.primary, borderColor: tokens.colors.primary },
  scaleButtonText: { color: tokens.colors.muted, fontWeight: '800' },
  scaleButtonTextActive: { color: tokens.colors.primaryText },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: tokens.colors.primary,
    borderRadius: tokens.radius.pill,
    padding: tokens.spacing.md,
  },
  primaryButtonText: { color: tokens.colors.primaryText, fontWeight: '800' },
});
