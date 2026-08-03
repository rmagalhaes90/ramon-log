import AsyncStorage from '@react-native-async-storage/async-storage';

const prefix = '@kyro:user:';

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
  const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(userPrefix));
  if (keys.length > 0) await AsyncStorage.multiRemove(keys);
}
