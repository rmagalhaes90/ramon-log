import { dateKey, dayKeys, todayDayKey, type DayKey } from '@kyro/domain';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { z } from 'zod';

import { useAuth } from '@/auth/AuthProvider';
import { Card, FeatureScreen, StateMessage, featureStyles } from '@/components/FeatureScreen';
import { useUserData } from '@/hooks/useUserData';
import { useLocale } from '@/i18n/LocaleProvider';
import { readUserCache, writeUserCache } from '@/services/local-data';
import { enableRestNotifications, scheduleRestNotification } from '@/services/notifications';
import { saveUserData, SyncConflictError } from '@/services/user-data';
import { tokens } from '@/theme/tokens';

const exerciseSchema = z
  .object({
    name: z.string(),
    sets: z.coerce.number().int().min(1).max(20),
    reps: z.string(),
    rest: z.coerce.number().int().min(0).max(1800).optional(),
  })
  .passthrough();
const workoutSchema = z
  .object({ title: z.string(), exercises: z.array(exerciseSchema), abs: z.array(exerciseSchema) })
  .passthrough();
const workoutsSchema = z.partialRecord(z.enum(dayKeys), workoutSchema);
const sessionSchema = z
  .object({
    id: z.string().max(60),
    date: z.string(),
    day: z.string(),
    title: z.string(),
    startedAt: z.iso.datetime().nullable(),
    endedAt: z.iso.datetime().nullable(),
    durationSec: z.number().nonnegative().nullable(),
    volume: z.number().nonnegative(),
    exerciseCount: z.number().int().nonnegative(),
  })
  .passthrough();
const sessionLogSchema = z.array(sessionSchema).max(450);
const notificationSettingsSchema = z.object({ restEnabled: z.boolean() }).passthrough();

interface SetDraft {
  kg: string;
  reps: string;
  done: boolean;
}
interface ExerciseDraft {
  name: string;
  rest: number;
  sets: SetDraft[];
}
interface WorkoutDraft {
  day: DayKey;
  startedAt: string;
  exercises: ExerciseDraft[];
}

const workoutDraftSchema: z.ZodType<WorkoutDraft> = z.object({
  day: z.enum(dayKeys),
  startedAt: z.iso.datetime(),
  exercises: z.array(
    z.object({
      name: z.string(),
      rest: z.number().int().nonnegative(),
      sets: z.array(z.object({ kg: z.string(), reps: z.string(), done: z.boolean() })).max(20),
    }),
  ),
});

const labels: Record<DayKey, string> = {
  domingo: 'Dom',
  segunda: 'Seg',
  terca: 'Ter',
  quarta: 'Qua',
  quinta: 'Qui',
  sexta: 'Sex',
  sabado: 'Sáb',
};

function createDraft(day: DayKey, workout: z.infer<typeof workoutSchema>): WorkoutDraft {
  return {
    day,
    startedAt: new Date().toISOString(),
    exercises: [...workout.exercises, ...workout.abs].map((exercise) => ({
      name: exercise.name,
      rest: exercise.rest ?? 90,
      sets: Array.from({ length: exercise.sets }, () => ({ kg: '', reps: '', done: false })),
    })),
  };
}

export default function WorkoutsScreen() {
  const { user } = useAuth();
  const { t } = useLocale();
  const { data, loading, error } = useUserData('workouts', workoutsSchema);
  const sessions = useUserData('sessionLog', sessionLogSchema);
  const notificationSettings = useUserData('notificationSettings', notificationSettingsSchema);
  const [localSessions, setLocalSessions] = useState<z.infer<typeof sessionLogSchema>>([]);
  const [selectedDay, setSelectedDay] = useState<DayKey>(todayDayKey());
  const [draft, setDraft] = useState<WorkoutDraft | null>(null);
  const [status, setStatus] = useState('');
  const [restAlerts, setRestAlerts] = useState(false);
  const workout = data?.[selectedDay];
  const draftKey = `workout-draft:${selectedDay}`;

  useEffect(() => setLocalSessions(sessions.data ?? []), [sessions.data]);
  useEffect(
    () => setRestAlerts(notificationSettings.data?.restEnabled === true),
    [notificationSettings.data],
  );

  useEffect(() => {
    if (!user) return;
    let active = true;
    void readUserCache(user.uid, draftKey).then((cached) => {
      const parsed = workoutDraftSchema.safeParse(cached);
      if (active && parsed.success) setDraft(parsed.data);
    });
    return () => {
      active = false;
    };
  }, [draftKey, user]);

  const totals = useMemo(() => {
    const completed =
      draft?.exercises.flatMap((exercise) => exercise.sets).filter((set) => set.done) ?? [];
    return {
      sets: completed.length,
      volume: completed.reduce(
        (total, set) => total + Number(set.kg.replace(',', '.')) * Number(set.reps),
        0,
      ),
      exercises:
        draft?.exercises.filter((exercise) => exercise.sets.some((set) => set.done)).length ?? 0,
    };
  }, [draft]);

  async function persistDraft(next: WorkoutDraft) {
    setDraft(next);
    if (user) await writeUserCache(user.uid, `workout-draft:${next.day}`, next);
  }

  function updateSet(exerciseIndex: number, setIndex: number, patch: Partial<SetDraft>) {
    if (!draft) return;
    const next = structuredClone(draft);
    const target = next.exercises[exerciseIndex]?.sets[setIndex];
    if (!target) return;
    Object.assign(target, patch);
    void persistDraft(next);
    if (patch.done === true && restAlerts) {
      const exercise = next.exercises[exerciseIndex];
      if (exercise) void scheduleRestNotification(exercise.rest, exercise.name);
    }
  }

  async function toggleRestAlerts() {
    if (restAlerts) {
      setRestAlerts(false);
      if (user)
        await saveUserData(user.uid, 'notificationSettings', notificationSettingsSchema, {
          ...(notificationSettings.data ?? {}),
          restEnabled: false,
        });
      return;
    }
    const enabled = await enableRestNotifications();
    setRestAlerts(enabled);
    if (enabled && user)
      await saveUserData(user.uid, 'notificationSettings', notificationSettingsSchema, {
        ...(notificationSettings.data ?? {}),
        restEnabled: true,
      });
    setStatus(
      enabled ? 'Alertas de descanso ativados.' : 'Permissão de notificações não concedida.',
    );
  }

  async function finishWorkout() {
    if (!user || !draft || !workout || totals.sets === 0) {
      setStatus('Complete ao menos uma série antes de finalizar.');
      return;
    }
    const endedAt = new Date();
    const startedAt = new Date(draft.startedAt);
    const session = {
      id: `${endedAt.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
      date: dateKey(endedAt),
      day: draft.day,
      title: workout.title,
      startedAt: draft.startedAt,
      endedAt: endedAt.toISOString(),
      durationSec: Math.min(
        86400,
        Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)),
      ),
      volume: Math.round(totals.volume * 100) / 100,
      exerciseCount: totals.exercises,
    };
    try {
      const nextSessions = [...localSessions, session].slice(-450);
      const result = await saveUserData(user.uid, 'sessionLog', sessionLogSchema, nextSessions);
      setLocalSessions(nextSessions);
      await writeUserCache(user.uid, draftKey, null);
      setDraft(null);
      setStatus(
        result === 'queued'
          ? 'Treino salvo no aparelho; sincronização pendente.'
          : 'Treino finalizado e sincronizado.',
      );
    } catch (cause) {
      setStatus(
        cause instanceof SyncConflictError
          ? 'O histórico mudou em outro aparelho. Reabra a tela antes de finalizar.'
          : 'Não foi possível finalizar; seu rascunho continua salvo.',
      );
    }
  }

  return (
    <FeatureScreen eyebrow={t('weeklyPlan')} title={t('workouts')}>
      <View style={styles.days}>
        {dayKeys.map((day) => (
          <Pressable
            accessibilityState={{ selected: selectedDay === day }}
            key={day}
            onPress={() => {
              setSelectedDay(day);
              setDraft(null);
              setStatus('');
            }}
            style={[styles.day, selectedDay === day && styles.dayActive]}
          >
            <Text style={[styles.dayText, selectedDay === day && styles.dayTextActive]}>
              {labels[day]}
            </Text>
          </Pressable>
        ))}
      </View>
      {loading ? <StateMessage>{t('loadingWorkouts')}</StateMessage> : null}
      {error ? <StateMessage error>{t('workoutsError')}</StateMessage> : null}
      {!loading && !error && !workout ? <StateMessage>{t('noWorkout')}</StateMessage> : null}
      {workout && !draft ? (
        <Card>
          <Text style={featureStyles.cardTitle}>{workout.title}</Text>
          <Text style={featureStyles.muted}>
            {workout.exercises.length + workout.abs.length} exercícios
          </Text>
          <Pressable
            onPress={() => void persistDraft(createDraft(selectedDay, workout))}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>{t('startWorkout')}</Text>
          </Pressable>
        </Card>
      ) : null}
      {draft?.exercises.map((exercise, exerciseIndex) => (
        <Card key={`${exercise.name}-${exerciseIndex}`}>
          <Text style={featureStyles.cardTitle}>{exercise.name}</Text>
          <Text style={featureStyles.muted}>Descanso sugerido: {exercise.rest}s</Text>
          {exercise.sets.map((set, setIndex) => (
            <View key={setIndex} style={styles.setRow}>
              <Text style={styles.setNumber}>{setIndex + 1}</Text>
              <TextInput
                accessibilityLabel={`Carga da série ${setIndex + 1}`}
                keyboardType="decimal-pad"
                onChangeText={(kg) => updateSet(exerciseIndex, setIndex, { kg })}
                placeholder="kg"
                placeholderTextColor={tokens.colors.muted}
                style={styles.input}
                value={set.kg}
              />
              <TextInput
                accessibilityLabel={`Repetições da série ${setIndex + 1}`}
                keyboardType="number-pad"
                onChangeText={(reps) => updateSet(exerciseIndex, setIndex, { reps })}
                placeholder="reps"
                placeholderTextColor={tokens.colors.muted}
                style={styles.input}
                value={set.reps}
              />
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: set.done }}
                onPress={() => updateSet(exerciseIndex, setIndex, { done: !set.done })}
                style={[styles.check, set.done && styles.checkDone]}
              >
                <Text style={styles.checkText}>{set.done ? '✓' : '○'}</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      ))}
      {draft ? (
        <Card>
          <Text style={featureStyles.cardTitle}>{t('workoutSummary')}</Text>
          <Text style={featureStyles.muted}>
            {totals.sets} séries · {totals.exercises} exercícios · {totals.volume.toFixed(0)} kg
          </Text>
          {status ? (
            <Text accessibilityLiveRegion="polite" style={featureStyles.muted}>
              {status}
            </Text>
          ) : null}
          <Pressable
            onPress={() =>
              void toggleRestAlerts().catch(() =>
                setStatus('Não foi possível salvar a preferência.'),
              )
            }
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>
              {restAlerts ? 'Desativar alertas de descanso' : 'Ativar alertas de descanso'}
            </Text>
          </Pressable>
          <Pressable onPress={() => void finishWorkout()} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{t('finishWorkout')}</Text>
          </Pressable>
        </Card>
      ) : status ? (
        <StateMessage>{status}</StateMessage>
      ) : null}
    </FeatureScreen>
  );
}

const styles = StyleSheet.create({
  days: { flexDirection: 'row', gap: tokens.spacing.xs, justifyContent: 'space-between' },
  day: {
    alignItems: 'center',
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    minWidth: 40,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.sm,
  },
  dayActive: { backgroundColor: tokens.colors.primary, borderColor: tokens.colors.primary },
  dayText: { color: tokens.colors.muted, fontSize: 12, fontWeight: '700' },
  dayTextActive: { color: tokens.colors.primaryText },
  setRow: { alignItems: 'center', flexDirection: 'row', gap: tokens.spacing.sm },
  setNumber: { color: tokens.colors.muted, textAlign: 'center', width: 20 },
  input: {
    backgroundColor: tokens.colors.surfaceElevated,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    color: tokens.colors.text,
    flex: 1,
    padding: tokens.spacing.sm,
    textAlign: 'center',
  },
  check: {
    alignItems: 'center',
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  checkDone: { backgroundColor: tokens.colors.primary, borderColor: tokens.colors.primary },
  checkText: { color: tokens.colors.primaryText, fontSize: 20, fontWeight: '900' },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: tokens.colors.primary,
    borderRadius: tokens.radius.pill,
    padding: tokens.spacing.md,
  },
  primaryButtonText: { color: tokens.colors.primaryText, fontWeight: '800' },
  secondaryButton: {
    alignItems: 'center',
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    padding: tokens.spacing.md,
  },
  secondaryButtonText: { color: tokens.colors.text, fontWeight: '800' },
});
