import type { Exercise } from '../../domain/schemas';

export interface ExerciseAlternative {
  exercise: Exercise;
  score: number;
  sharedMuscles: string[];
}

export function rankExerciseAlternatives(
  current: Exercise,
  catalog: Exercise[],
  limit = 3,
): ExerciseAlternative[] {
  const currentMuscles = new Set(
    Object.entries(current.muscles)
      .filter(([, contribution]) => contribution > 0)
      .map(([muscle]) => muscle),
  );
  return catalog
    .filter((candidate) => candidate.name !== current.name)
    .map((exercise) => {
      const sharedMuscles = Object.entries(exercise.muscles)
        .filter(([muscle, contribution]) => contribution > 0 && currentMuscles.has(muscle))
        .map(([muscle]) => muscle);
      const muscleScore = sharedMuscles.reduce(
        (total, muscle) =>
          total + Math.min(current.muscles[muscle] ?? 0, exercise.muscles[muscle] ?? 0),
        0,
      );
      const equipmentBonus = exercise.equipment !== current.equipment ? 0.15 : 0;
      return { exercise, sharedMuscles, score: muscleScore + equipmentBonus };
    })
    .filter(({ sharedMuscles }) => sharedMuscles.length > 0)
    .sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name))
    .slice(0, Math.max(0, limit));
}
