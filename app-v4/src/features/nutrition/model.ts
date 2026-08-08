import type { Meal, NutritionDay } from '../../domain/schemas';

export const nutritionDefaults = {
  kcalGoal: 2400,
  proteinGoal: 150,
  carbGoal: 250,
  fatGoal: 70,
  waterGoal: 3.5,
  fiberGoal: 30,
} as const;
export function emptyNutritionDay(previous?: NutritionDay): NutritionDay {
  return {
    kcal: 0,
    protein: 0,
    carb: 0,
    fat: 0,
    fiber: 0,
    water: 0,
    meals: [],
    kcalGoal: previous?.kcalGoal ?? nutritionDefaults.kcalGoal,
    proteinGoal: previous?.proteinGoal ?? nutritionDefaults.proteinGoal,
    carbGoal: previous?.carbGoal ?? nutritionDefaults.carbGoal,
    fatGoal: previous?.fatGoal ?? nutritionDefaults.fatGoal,
    fiberGoal: previous?.fiberGoal ?? nutritionDefaults.fiberGoal,
    waterGoal: previous?.waterGoal ?? nutritionDefaults.waterGoal,
  };
}

export function addMealToDay(day: NutritionDay, meal: Meal): NutritionDay {
  if (day.meals.length >= 200) throw new Error('mealLimit');
  return {
    ...day,
    kcal: day.kcal + meal.kcal,
    protein: day.protein + meal.prot,
    carb: day.carb + meal.carb,
    fat: day.fat + meal.fat,
    fiber: day.fiber + meal.fiber,
    meals: [...day.meals, meal],
  };
}

export function copyMeal(meal: Meal, id: string, timestamp = new Date().toISOString()): Meal {
  return { ...meal, id, t: timestamp };
}

export function mergeNutritionDays(
  target: NutritionDay,
  source: NutritionDay,
  createId: () => string,
  timestamp = new Date().toISOString(),
): NutritionDay {
  return source.meals.reduce(
    (day, meal) => addMealToDay(day, copyMeal(meal, createId(), timestamp)),
    target,
  );
}
export function percentage(value: number, goal: number): number {
  return goal <= 0 ? 0 : Math.min(100, Math.max(0, (value / goal) * 100));
}
