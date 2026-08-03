import { dateKey } from '@kyro/domain';
import { Text } from 'react-native';
import { z } from 'zod';

import { Card, FeatureScreen, StateMessage, featureStyles } from '@/components/FeatureScreen';
import { useUserData } from '@/hooks/useUserData';

const mealSchema = z.object({
  id: z.string(),
  name: z.string(),
  kcal: z.number(),
  prot: z.number(),
  carb: z.number(),
  fat: z.number(),
});
const nutritionSchema = z.record(
  z.string(),
  z.object({
    kcal: z.number(),
    protein: z.number(),
    carb: z.number(),
    fat: z.number(),
    water: z.number(),
    kcalGoal: z.number(),
    proteinGoal: z.number(),
    meals: z.array(mealSchema),
  }),
);

export default function NutritionScreen() {
  const { data, loading, error } = useUserData('nutritionLog', nutritionSchema);
  const today = data?.[dateKey()];
  return (
    <FeatureScreen eyebrow="RESUMO DIÁRIO" title="Nutrição">
      {loading ? <StateMessage>Carregando nutrição…</StateMessage> : null}
      {error ? <StateMessage error>Não foi possível carregar a nutrição.</StateMessage> : null}
      {!loading && !today ? <StateMessage>Nenhum registro para hoje.</StateMessage> : null}
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
            <Text style={featureStyles.muted}>
              Carboidratos {Math.round(today.carb)} g · Gorduras {Math.round(today.fat)} g
            </Text>
          </Card>
          <Card>
            <Text style={featureStyles.cardTitle}>Refeições</Text>
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
