import { dateKey } from '@kyro/domain';
import { useState } from 'react';
import { z } from 'zod';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { Card, FeatureScreen, StateMessage, featureStyles } from '@/components/FeatureScreen';
import { useUserData } from '@/hooks/useUserData';
import { useLocale } from '@/i18n/LocaleProvider';
import { saveUserData, SyncConflictError } from '@/services/user-data';
import { tokens } from '@/theme/tokens';

const weightsSchema = z.array(z.object({ d: z.string(), kg: z.number() })).max(5000);
const measurementsSchema = z.record(
  z.string(),
  z.object({
    waist: z.number().optional(),
    chest: z.number().optional(),
    arm: z.number().optional(),
    hip: z.number().optional(),
    thigh: z.number().optional(),
  }),
);

export default function ProgressScreen() {
  const { user } = useAuth();
  const { t } = useLocale();
  const [weightInput, setWeightInput] = useState('');
  const [waistInput, setWaistInput] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const weights = useUserData('bodyWeights', weightsSchema);
  const measurements = useUserData('bodyMeasurements', measurementsSchema);
  const latestWeights = [...(weights.data ?? [])]
    .sort((a, b) => b.d.localeCompare(a.d))
    .slice(0, 8);
  const latestMeasurements = Object.entries(measurements.data ?? {})
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 5);
  const loading = weights.loading || measurements.loading;
  const error = weights.error || measurements.error;

  async function saveProgress() {
    if (!user) return;
    const weight = Number(weightInput.replace(',', '.'));
    const waist = Number(waistInput.replace(',', '.'));
    if ((!Number.isFinite(weight) || weight <= 0) && (!Number.isFinite(waist) || waist <= 0)) {
      setSaveStatus('Informe um peso ou cintura válido.');
      return;
    }
    try {
      const results: Array<'synced' | 'queued'> = [];
      const today = dateKey();
      if (Number.isFinite(weight) && weight > 0) {
        const nextWeights = [
          ...(weights.data ?? []).filter((item) => item.d !== today),
          { d: today, kg: weight },
        ];
        results.push(await saveUserData(user.uid, 'bodyWeights', weightsSchema, nextWeights));
      }
      if (Number.isFinite(waist) && waist > 0) {
        const nextMeasurements = {
          ...(measurements.data ?? {}),
          [today]: { ...(measurements.data?.[today] ?? {}), waist },
        };
        results.push(
          await saveUserData(user.uid, 'bodyMeasurements', measurementsSchema, nextMeasurements),
        );
      }
      setSaveStatus(
        results.includes('queued')
          ? 'Salvo no aparelho; sincronização pendente.'
          : 'Progresso sincronizado.',
      );
      setWeightInput('');
      setWaistInput('');
    } catch (cause) {
      setSaveStatus(
        cause instanceof SyncConflictError
          ? 'Conflito detectado: atualize antes de substituir dados de outro dispositivo.'
          : 'Não foi possível salvar.',
      );
    }
  }
  return (
    <FeatureScreen eyebrow={t('evolution')} title={t('progress')}>
      {loading ? <StateMessage>{t('loadingProgress')}</StateMessage> : null}
      {error ? <StateMessage error>{t('progressError')}</StateMessage> : null}
      <Card>
        <Text style={featureStyles.cardTitle}>{t('registerToday')}</Text>
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={setWeightInput}
          placeholder="Peso (kg)"
          placeholderTextColor={tokens.colors.muted}
          style={styles.input}
          value={weightInput}
        />
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={setWaistInput}
          placeholder="Cintura (cm)"
          placeholderTextColor={tokens.colors.muted}
          style={styles.input}
          value={waistInput}
        />
        {saveStatus ? (
          <Text accessibilityLiveRegion="polite" style={featureStyles.muted}>
            {saveStatus}
          </Text>
        ) : null}
        <Pressable onPress={() => void saveProgress()} style={styles.button}>
          <Text style={styles.buttonText}>{t('saveProgress')}</Text>
        </Pressable>
      </Card>
      <Card>
        <Text style={featureStyles.cardTitle}>{t('recentWeight')}</Text>
        {latestWeights.length ? (
          latestWeights.map((entry) => (
            <Text key={entry.d} style={featureStyles.muted}>
              {entry.d} · {entry.kg.toFixed(1)} kg
            </Text>
          ))
        ) : (
          <Text style={featureStyles.muted}>{t('noRecords')}</Text>
        )}
      </Card>
      <Card>
        <Text style={featureStyles.cardTitle}>{t('recentMeasures')}</Text>
        {latestMeasurements.length ? (
          latestMeasurements.map(([date, values]) => (
            <Text key={date} style={featureStyles.muted}>
              {date} ·{' '}
              {Object.entries(values)
                .map(([key, value]) => `${key}: ${value} cm`)
                .join(' · ')}
            </Text>
          ))
        ) : (
          <Text style={featureStyles.muted}>{t('noRecords')}</Text>
        )}
      </Card>
    </FeatureScreen>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: tokens.colors.surfaceElevated,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    color: tokens.colors.text,
    fontSize: 16,
    padding: tokens.spacing.md,
  },
  button: {
    alignItems: 'center',
    backgroundColor: tokens.colors.primary,
    borderRadius: tokens.radius.pill,
    padding: tokens.spacing.md,
  },
  buttonText: { color: tokens.colors.primaryText, fontWeight: '800' },
});
