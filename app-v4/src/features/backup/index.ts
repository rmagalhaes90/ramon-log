import type { User } from 'firebase/auth';
import { z } from 'zod';
import { userDataSchemas, type UserDataKey } from '../../domain/schemas';
import { loadUserData, saveUserData } from '../../services/user-data';

export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
const backupDataSchema = z
  .object({
    workouts: userDataSchemas.workouts.optional(),
    bodyWeights: userDataSchemas.bodyWeights.optional(),
    bodyMeasurements: userDataSchemas.bodyMeasurements.optional(),
    sessionLog: userDataSchemas.sessionLog.optional(),
    readinessLog: userDataSchemas.readinessLog.optional(),
    nutritionLog: userDataSchemas.nutritionLog.optional(),
    profile: userDataSchemas.profile.optional(),
    photoIndex: userDataSchemas.photoIndex.optional(),
    mySupplements: userDataSchemas.mySupplements.optional(),
    supplementLog: userDataSchemas.supplementLog.optional(),
    exerciseHistory: userDataSchemas.exerciseHistory.optional(),
    exerciseRecords: userDataSchemas.exerciseRecords.optional(),
    notificationSettings: userDataSchemas.notificationSettings.optional(),
  })
  .strict();
export const backupSchema = z
  .object({
    format: z.literal('kyro-v4-backup'),
    version: z.literal(1),
    exportedAt: z.iso.datetime(),
    data: backupDataSchema,
  })
  .strict();
export type Backup = z.infer<typeof backupSchema>;
const keys = Object.keys(userDataSchemas) as UserDataKey[];

export function parseBackup(text: string): Backup {
  if (new Blob([text]).size > MAX_BACKUP_BYTES) throw new Error('backupTooLarge');
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('backupInvalid');
  }
  const result = backupSchema.safeParse(value);
  if (!result.success) throw new Error('backupInvalid');
  return result.data;
}

export async function createBackup(user: User): Promise<Backup> {
  const values = await Promise.all(
    keys.map(async (key) => [key, await loadUserData(user, key)] as const),
  );
  return backupSchema.parse({
    format: 'kyro-v4-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: Object.fromEntries(values.filter(([, value]) => value !== null)),
  });
}

export async function restoreBackup(user: User, backup: Backup): Promise<void> {
  const entries = Object.entries(backup.data) as [UserDataKey, unknown][];
  const previous = new Map<UserDataKey, unknown>();
  for (const [key] of entries) previous.set(key, await loadUserData(user, key));
  try {
    for (const [key, value] of entries)
      await saveUserData(user, key, userDataSchemas[key].parse(value) as never);
  } catch (error) {
    await Promise.allSettled(
      [...previous]
        .filter((entry) => entry[1] !== null)
        .map(([key, value]) => saveUserData(user, key, value as never)),
    );
    throw error;
  }
}
