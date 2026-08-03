import AsyncStorage from '@react-native-async-storage/async-storage';

const prefix = '@kyro:user:';
const queuePrefix = '@kyro:queue:';

export interface PendingWrite {
  uid: string;
  key: string;
  value: unknown;
  updatedAt: string;
  baseUpdatedAt?: string;
  attempts: number;
}

export function userCacheKey(uid: string, key: string): string {
  return `${prefix}${uid}:${key}`;
}

export async function readUserCache(uid: string, key: string): Promise<unknown> {
  const value = await AsyncStorage.getItem(userCacheKey(uid, key));
  return value ? (JSON.parse(value) as unknown) : undefined;
}

export async function writeUserCache(uid: string, key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(userCacheKey(uid, key), JSON.stringify(value));
}

export async function clearUserCache(uid: string): Promise<void> {
  const userPrefix = `${prefix}${uid}:`;
  const keys = (await AsyncStorage.getAllKeys()).filter(
    (key) => key.startsWith(userPrefix) || key.startsWith(`${queuePrefix}${uid}:`),
  );
  if (keys.length > 0) await AsyncStorage.multiRemove(keys);
}

export async function putPendingWrite(write: PendingWrite): Promise<void> {
  await AsyncStorage.setItem(`${queuePrefix}${write.uid}:${write.key}`, JSON.stringify(write));
}

export async function pendingWrites(uid: string): Promise<PendingWrite[]> {
  const keys = (await AsyncStorage.getAllKeys()).filter((key) =>
    key.startsWith(`${queuePrefix}${uid}:`),
  );
  const values = await AsyncStorage.multiGet(keys);
  return values.flatMap(([, value]) => {
    if (!value) return [];
    try {
      return [JSON.parse(value) as PendingWrite];
    } catch {
      return [];
    }
  });
}

export async function deletePendingWrite(uid: string, key: string): Promise<void> {
  await AsyncStorage.removeItem(`${queuePrefix}${uid}:${key}`);
}
