import { z } from 'zod';

export const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const safeIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,200}$/);
const boundedText = (max: number) => z.string().max(max).default('');
const finite = (min: number, max: number) => z.number().finite().min(min).max(max);
const videoUrlSchema = z
  .string()
  .max(2048)
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return (
        url.protocol === 'https:' &&
        ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(
          url.hostname.toLowerCase(),
        )
      );
    } catch {
      return false;
    }
  }, 'Only HTTPS YouTube URLs are supported')
  .default('');

export const loggedSetSchema = z.object({
  kg: finite(0.01, 1000),
  reps: finite(1, 1000),
  rir: finite(0, 10).optional(),
  rpe: finite(1, 10).optional(),
});
export type LoggedSet = z.infer<typeof loggedSetSchema>;

export const exerciseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sets: z.coerce.number().int().min(1).max(20).default(4),
  reps: boundedText(20).pipe(z.string().min(1)).default('10'),
  rest: z.coerce.number().int().min(0).max(1800).default(90),
  equipment: z.enum(['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', '']).default(''),
  muscles: z.record(z.string().max(32), finite(0, 1)).default({}),
  videoUrl: videoUrlSchema,
  notes: boundedText(1000),
});
export type Exercise = z.infer<typeof exerciseSchema>;

export const supplementSchema = z.object({
  id: z.string().max(60).optional(),
  name: z.string().trim().min(1).max(100),
  nameEn: z.string().max(100).optional(),
  category: z.string().max(60).default(''),
  timing: z.string().max(200).optional(),
  timingEn: z.string().max(200).optional(),
});
export const userSupplementSchema = supplementSchema.extend({
  id: safeIdSchema,
  times: z
    .array(z.string().regex(/^\d{2}:\d{2}$/))
    .max(10)
    .default([]),
  custom: z.boolean().default(false),
});
export type UserSupplement = z.infer<typeof userSupplementSchema>;
export const supplementsSchema = z.array(userSupplementSchema).max(100);
export const supplementLogSchema = z.record(
  dateKeySchema,
  z.record(z.string().max(60), z.array(z.boolean()).max(10)),
);

export const exerciseHistoryEntrySchema = z.object({
  date: dateKeySchema,
  sets: z.array(loggedSetSchema).max(20),
  e1rm: finite(0, 2000),
});
export const exerciseHistorySchema = z.record(
  z.string().max(120),
  z.array(exerciseHistoryEntrySchema).max(60),
);
export const exerciseRecordSchema = z.object({
  maxWeight: finite(0, 1000),
  maxWeightReps: finite(0, 1000),
  maxE1rm: finite(0, 2000),
  maxWeightDate: dateKeySchema.nullable(),
  maxE1rmDate: dateKeySchema.nullable(),
});
export const exerciseRecordsSchema = z.record(z.string().max(120), exerciseRecordSchema);
export const progressionDecisionSchema = z.object({
  id: safeIdSchema,
  exercise: z.string().trim().min(1).max(120),
  action: z.enum(['increase', 'maintain', 'deload', 'plateau']),
  accepted: z.boolean(),
  suggestedLoad: finite(0, 1000).nullable(),
  evidenceDate: dateKeySchema.optional(),
  reason: boundedText(300),
  decidedAt: z.iso.datetime(),
});
export type ProgressionDecision = z.infer<typeof progressionDecisionSchema>;
export const progressionDecisionsSchema = z.array(progressionDecisionSchema).max(500);

export const workoutSchema = z.object({
  title: z.string().trim().min(1).max(80),
  titleEn: boundedText(80),
  cardioNote: boundedText(300),
  exercises: z.array(exerciseSchema).max(60).default([]),
  abs: z.array(exerciseSchema).max(30).default([]),
});
const dayKeyValues = [
  'domingo',
  'segunda',
  'terca',
  'quarta',
  'quinta',
  'sexta',
  'sabado',
] as const;

export const workoutsSchema = z.preprocess(
  (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    return Object.fromEntries(
      Object.entries(value).filter(
        ([day, workout]) => dayKeyValues.includes(day as (typeof dayKeyValues)[number]) && workout,
      ),
    );
  },
  z.partialRecord(z.enum(dayKeyValues), workoutSchema),
);
export type Workouts = z.infer<typeof workoutsSchema>;

export const bodyWeightSchema = z.object({ d: dateKeySchema, kg: finite(0.01, 1000) });
export const bodyWeightsSchema = z.array(bodyWeightSchema).max(5000);
export const bodyMeasurementSchema = z
  .object({
    waist: finite(20, 300).optional(),
    chest: finite(20, 300).optional(),
    arm: finite(10, 150).optional(),
    hip: finite(20, 300).optional(),
    thigh: finite(10, 200).optional(),
  })
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    'At least one measurement is required',
  );
export const bodyMeasurementsSchema = z.record(dateKeySchema, bodyMeasurementSchema);

export const sessionSchema = z.object({
  id: z.string().max(60),
  date: dateKeySchema,
  day: boundedText(20),
  title: boundedText(200),
  startedAt: z.iso.datetime().nullable(),
  endedAt: z.iso.datetime().nullable(),
  durationSec: finite(0, 86400).nullable(),
  volume: finite(0, 10_000_000),
  exerciseCount: z.number().int().min(0).max(200),
});
export const sessionLogSchema = z.array(sessionSchema).max(450);

export const readinessSchema = z.object({
  sleep: z.number().int().min(1).max(5),
  energy: z.number().int().min(1).max(5),
  soreness: z.number().int().min(1).max(5),
  stress: z.number().int().min(1).max(5),
  score: finite(0, 100),
  classification: boundedText(60),
  plannedClassification: boundedText(60).optional(),
  overrideReason: boundedText(300).optional(),
  recordedAt: z.iso.datetime(),
});
export const readinessLogSchema = z.record(dateKeySchema, readinessSchema);

export const mealSchema = z.object({
  id: z.string().max(60),
  name: boundedText(120),
  kcal: finite(0, 10_000),
  prot: finite(0, 1000),
  carb: finite(0, 1000),
  fat: finite(0, 1000),
  fiber: finite(0, 1000).default(0),
  t: z.iso.datetime(),
});
export type Meal = z.infer<typeof mealSchema>;
export const nutritionDaySchema = z.object({
  kcal: finite(0, 50_000),
  protein: finite(0, 5000),
  carb: finite(0, 5000),
  fat: finite(0, 5000),
  fiber: finite(0, 5000).default(0),
  water: finite(0, 50),
  meals: z.array(mealSchema).max(200),
  kcalGoal: finite(1, 10_000),
  proteinGoal: finite(1, 1000),
  carbGoal: finite(1, 1000),
  fatGoal: finite(1, 1000),
  fiberGoal: finite(1, 1000).default(30),
  waterGoal: finite(0.5, 20),
});
export type NutritionDay = z.infer<typeof nutritionDaySchema>;
export const nutritionLogSchema = z.record(dateKeySchema, nutritionDaySchema);
export const favoriteMealSchema = mealSchema
  .omit({ t: true })
  .extend({ id: safeIdSchema, createdAt: z.iso.datetime() });
export type FavoriteMeal = z.infer<typeof favoriteMealSchema>;
export const favoriteMealsSchema = z.array(favoriteMealSchema).max(100);

export const profileSchema = z.object({
  height: finite(50, 250).nullable().default(null),
  sex: z.enum(['M', 'F']).default('M'),
});

export const photoSchema = z.object({ id: safeIdSchema, d: dateKeySchema });
export const photoIndexSchema = z.array(photoSchema).max(5000);
export const notificationSettingsSchema = z.object({ restEnabled: z.boolean().default(false) });

export const userDataSchemas = {
  workouts: workoutsSchema,
  bodyWeights: bodyWeightsSchema,
  bodyMeasurements: bodyMeasurementsSchema,
  sessionLog: sessionLogSchema,
  readinessLog: readinessLogSchema,
  nutritionLog: nutritionLogSchema,
  favoriteMeals: favoriteMealsSchema,
  profile: profileSchema,
  photoIndex: photoIndexSchema,
  mySupplements: supplementsSchema,
  supplementLog: supplementLogSchema,
  exerciseHistory: exerciseHistorySchema,
  exerciseRecords: exerciseRecordsSchema,
  progressionDecisions: progressionDecisionsSchema,
  notificationSettings: notificationSettingsSchema,
} as const;

export type UserDataKey = keyof typeof userDataSchemas;
