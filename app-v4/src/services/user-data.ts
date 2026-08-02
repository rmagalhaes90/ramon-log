import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { z } from 'zod';
import { userDataSchemas, type UserDataKey } from '../domain/schemas';
import { cacheGet, cacheSet } from './database';
import { enqueue, flushQueue } from './offline-queue';
import { getFirebaseServices } from './firebase';

function cacheKey(uid: string, key: UserDataKey): string { return `user:${uid}:${key}`; }
function dataRef(uid: string, key: UserDataKey) {
  const services = getFirebaseServices();
  if (!services) throw new Error('Firebase unavailable');
  return doc(services.firestore, 'users', uid, 'data', key);
}

type UserDataValue<K extends UserDataKey> = z.output<(typeof userDataSchemas)[K]>;

export async function loadUserData<K extends UserDataKey>(user: User, key: K): Promise<UserDataValue<K> | null> {
  const schema = userDataSchemas[key] as unknown as z.ZodType<UserDataValue<K>>;
  const cached = await cacheGet<unknown>(cacheKey(user.uid, key));
  const cachedResult = schema.safeParse(cached);
  try {
    const snapshot = await getDoc(dataRef(user.uid, key));
    if (!snapshot.exists()) return cachedResult.success ? cachedResult.data : null;
    const result = schema.safeParse(snapshot.data().value);
    if (!result.success) throw new Error(`Invalid ${key} document`);
    await cacheSet(cacheKey(user.uid, key), result.data);
    return result.data;
  } catch (error) {
    if (cachedResult.success) return cachedResult.data;
    throw error;
  }
}

export async function saveUserData<K extends UserDataKey>(user: User, key: K, value: UserDataValue<K>): Promise<void> {
  const schema = userDataSchemas[key] as unknown as z.ZodType<UserDataValue<K>>;
  const clean = schema.parse(value);
  await cacheSet(cacheKey(user.uid, key), clean);
  try {
    if (!navigator.onLine) throw new Error('offline');
    await setDoc(dataRef(user.uid, key), { value: clean });
  } catch {
    await enqueue({ id: `${user.uid}-${key}`, feature: 'user-data', operation: 'set', path: key, payload: clean });
  }
}

export async function flushUserDataQueue(user: User): Promise<number> {
  return flushQueue(async (item) => {
    if (item.feature !== 'user-data' || item.operation !== 'set' || !(item.path in userDataSchemas)) return;
    const key = item.path as UserDataKey;
    const clean = userDataSchemas[key].parse(item.payload);
    await setDoc(dataRef(user.uid, key), { value: clean });
  });
}
