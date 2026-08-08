import { dateKey } from '@kyro/domain';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { Card, FeatureScreen, StateMessage, featureStyles } from '@/components/FeatureScreen';
import { useAuth } from '@/auth/AuthProvider';
import { useUserData } from '@/hooks/useUserData';
import { useLocale } from '@/i18n/LocaleProvider';
import { saveUserData, SyncConflictError } from '@/services/user-data';
import { tokens } from '@/theme/tokens';

const mealSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    kcal: z.number(),
    prot: z.number(),
    carb: z.number(),
    fat: z.number(),
  })
  .passthrough();
const nutritionSchema = z.record(
  z.string(),
  z
    .object({
      kcal: z.number(),
      protein: z.number(),
      carb: z.number(),
      fat: z.number(),
      water: z.number(),
      kcalGoal: z.number(),
      proteinGoal: z.number(),
      meals: z.array(mealSchema),
    })
    .passthrough(),
);

export default function NutritionScreen() {
  const { user } = useAuth();
  const { t } = useLocale();
  const { data, loading, error } = useUserData('nutritionLog', nutritionSchema);
  const today = data?.[dateKey()];
  const [status, setStatus] = useState('');

  async function addWater(liters: number) {
    if (!user || !today || !data) return;
    const next = {
      ...data,
      [dateKey()]: { ...today, water: Math.max(0, Math.min(20, today.water + liters)) },
    };
    try {
      const result = await saveUserData(user.uid, 'nutritionLog', nutritionSchema, next);
      setStatus(result === 'queued' ? 'Água salva offline.' : 'Água sincronizada.');
    } catch (cause) {
      setStatus(
        cause instanceof SyncConflictError
          ? 'Conflito detectado. Atualize os dados.'
          : 'Falha ao salvar.',
      );
    }
  }
  return (
    <FeatureScreen eyebrow={t('dailySummary')} title={t('nutrition')}>
      {loading ? <StateMessage>{t('loadingNutrition')}</StateMessage> : null}
      {error ? <StateMessage error>{t('nutritionError')}</StateMessage> : null}
      {!loading && !today ? <StateMessage>{t('noToday')}</StateMessage> : null}
      {today ? (
        <>
          <Card>
            <Text style={featureStyles.cardTitle}>
              {Math.round(today.kcal)} / {Math.round(today.kcalGoal)} kcal
            </Text>
            <Text style={featureStyles.muted}>
              Proteína {Math.round(today.protein)} / {Math.round(today.proteinGoal)} g · Água{' '}
              {today.water.toFixed(1)} L
            </Text>
            <View style={styles.actions}>
              <Pressable onPress={() => void addWater(-0.25)} style={styles.secondary}>
                <Text style={styles.secondaryText}>− 250 ml</Text>
              </Pressable>
              <Pressable onPress={() => void addWater(0.25)} style={styles.primary}>
                <Text style={styles.primaryText}>+ 250 ml</Text>
              </Pressable>
            </View>
            {status ? (
              <Text accessibilityLiveRegion="polite" style={featureStyles.muted}>
                {status}
              </Text>
            ) : null}
            <Text style={featureStyles.muted}>
              Carboidratos {Math.round(today.carb)} g · Gorduras {Math.round(today.fat)} g
            </Text>
          </Card>
          <Card>
            <Text style={featureStyles.cardTitle}>{t('meals')}</Text>
            {today.meals.map((meal) => (
              <Text key={meal.id} style={featureStyles.muted}>
                {meal.name} · {Math.round(meal.kcal)} kcal · P {Math.round(meal.prot)} g
              </Text>
            ))}
          </Card>
        </>
      ) : null}
    </FeatureScreen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: tokens.spacing.sm },
  primary: {
    backgroundColor: tokens.colors.primary,
    borderRadius: tokens.radius.pill,
    padding: tokens.spacing.sm,
  },
  primaryText: { color: tokens.colors.primaryText, fontWeight: '800' },
  secondary: {
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    padding: tokens.spacing.sm,
  },
  secondaryText: { color: tokens.colors.text, fontWeight: '700' },
});
