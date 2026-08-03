import { dayKeys } from '@kyro/domain';
import { Text } from 'react-native';
import { z } from 'zod';

import { Card, FeatureScreen, StateMessage, featureStyles } from '@/components/FeatureScreen';
import { useUserData } from '@/hooks/useUserData';

const exerciseSchema = z.object({ name: z.string(), sets: z.number(), reps: z.string() });
const workoutSchema = z.object({
  title: z.string(),
  exercises: z.array(exerciseSchema),
  abs: z.array(exerciseSchema),
});
const workoutsSchema = z.record(z.string(), workoutSchema);

export default function WorkoutsScreen() {
  const { data, loading, error } = useUserData('workouts', workoutsSchema);
  return (
    <FeatureScreen eyebrow="PLANO SEMANAL" title="Treinos">
      {loading ? <StateMessage>Carregando treinos…</StateMessage> : null}
      {error ? <StateMessage error>Não foi possível carregar os treinos.</StateMessage> : null}
      {!loading && !error && !data ? <StateMessage>Nenhum plano configurado.</StateMessage> : null}
      {dayKeys.map((day) => {
        const workout = data?.[day];
        if (!workout) return null;
        return (
          <Card key={day}>
            <Text style={featureStyles.muted}>{day.toUpperCase()}</Text>
            <Text style={featureStyles.cardTitle}>{workout.title}</Text>
            {[...workout.exercises, ...workout.abs].map((exercise, index) => (
              <Text key={`${exercise.name}-${index}`} style={featureStyles.muted}>
                {exercise.name} · {exercise.sets} × {exercise.reps}
              </Text>
            ))}
          </Card>
        );
      })}
    </FeatureScreen>
  );
}
