import exercisesJson from '../../data/exercises.json';
import supplementsJson from '../../data/supplements.json';
import { exerciseSchema, supplementSchema, type Exercise } from '../../domain/schemas';

export const exerciseCatalog: Exercise[] = exerciseSchema.array().parse(exercisesJson);
export const supplementCatalog = supplementSchema.array().parse(supplementsJson);

export function searchExercises(query: string, locale: 'pt' | 'en'): Exercise[] {
  const normalized = query.trim().toLocaleLowerCase(locale === 'pt' ? 'pt-BR' : 'en-US');
  if (!normalized) return exerciseCatalog;
  return exerciseCatalog.filter(
    (exercise) =>
      exercise.name.toLocaleLowerCase().includes(normalized) ||
      Object.keys(exercise.muscles).some((muscle) =>
        muscle.toLocaleLowerCase().includes(normalized),
      ) ||
      exercise.equipment.toLocaleLowerCase().includes(normalized),
  );
}
