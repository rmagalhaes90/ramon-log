import type { User } from 'firebase/auth';
import { saveUserData } from '../../services/user-data';
export type ResetGroup = 'training' | 'progress' | 'nutrition';
export const resetKeys: Record<ResetGroup, string[]> = {
  training: ['workouts', 'sessionLog', 'exerciseHistory', 'exerciseRecords'],
  progress: ['bodyWeights', 'bodyMeasurements', 'readinessLog'],
  nutrition: ['nutritionLog', 'mySupplements', 'supplementLog'],
};
export async function resetFeatureGroup(user: User, group: ResetGroup): Promise<void> {
  if (group === 'training') {
    await Promise.all([
      saveUserData(user, 'workouts', {}),
      saveUserData(user, 'sessionLog', []),
      saveUserData(user, 'exerciseHistory', {}),
      saveUserData(user, 'exerciseRecords', {}),
    ]);
    return;
  }
  if (group === 'progress') {
    await Promise.all([
      saveUserData(user, 'bodyWeights', []),
      saveUserData(user, 'bodyMeasurements', {}),
      saveUserData(user, 'readinessLog', {}),
    ]);
    return;
  }
  await Promise.all([
    saveUserData(user, 'nutritionLog', {}),
    saveUserData(user, 'mySupplements', []),
    saveUserData(user, 'supplementLog', {}),
  ]);
}
