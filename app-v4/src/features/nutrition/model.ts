import type { NutritionDay } from '../../domain/schemas';

export const nutritionDefaults = {
  kcalGoal: 2400,
  proteinGoal: 150,
  carbGoal: 250,
  fatGoal: 70,
  waterGoal: 3.5,
} as const;
export function emptyNutritionDay(previous?: NutritionDay): NutritionDay {
  return {
    kcal: 0,
    protein: 0,
    carb: 0,
    fat: 0,
    water: 0,
    meals: [],
    kcalGoal: previous?.kcalGoal ?? nutritionDefaults.kcalGoal,
    proteinGoal: previous?.proteinGoal ?? nutritionDefaults.proteinGoal,
    carbGoal: previous?.carbGoal ?? nutritionDefaults.carbGoal,
    fatGoal: previous?.fatGoal ?? nutritionDefaults.fatGoal,
    waterGoal: previous?.waterGoal ?? nutritionDefaults.waterGoal,
  };
}
export function percentage(value: number, goal: number): number {
  return goal <= 0 ? 0 : Math.min(100, Math.max(0, (value / goal) * 100));
}
