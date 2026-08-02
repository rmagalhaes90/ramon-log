import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { z } from 'zod';
import { userDataSchemas, type UserDataKey } from '../domain/schemas';
import { cacheGet, cacheSet, queueList } from './database';
import { enqueue, flushQueue } from './offline-queue';
import { getFirebaseServices } from './firebase';

function cacheKey(uid: string, key: UserDataKey): string {
  return `user:${uid}:${key}`;
}
function revisionKey(uid: string, key: UserDataKey): string {
  return `revision:${uid}:${key}`;
}
function dataRef(uid: string, key: UserDataKey) {
  const services = getFirebaseServices();
  if (!services) throw new Error('Firebase unavailable');
  return doc(services.firestore, 'users', uid, 'data', key);
}

type UserDataValue<K extends UserDataKey> = z.output<(typeof userDataSchemas)[K]>;

export async function loadUserData<K extends UserDataKey>(
  user: User,
  key: K,
): Promise<UserDataValue<K> | null> {
  const schema = userDataSchemas[key] as unknown as z.ZodType<UserDataValue<K>>;
  const cached = await cacheGet<unknown>(cacheKey(user.uid, key));
  const cachedResult = schema.safeParse(cached);
  const hasPending = (await queueList()).some(
    (item) => item.id === `${user.uid}-${key}` && item.feature === 'user-data',
  );
  if (hasPending && cachedResult.success) return cachedResult.data;
  try {
    const snapshot = await getDoc(dataRef(user.uid, key));
    if (!snapshot.exists()) return cachedResult.success ? cachedResult.data : null;
    const result = schema.safeParse(snapshot.data().value);
    if (!result.success) throw new Error(`Invalid ${key} document`);
    await cacheSet(cacheKey(user.uid, key), result.data);
    if (typeof snapshot.data().updatedAt === 'string')
      await cacheSet(revisionKey(user.uid, key), snapshot.data().updatedAt);
    return result.data;
  } catch (error) {
    if (cachedResult.success) return cachedResult.data;
    throw error;
  }
}

export async function saveUserData<K extends UserDataKey>(
  user: User,
  key: K,
  value: UserDataValue<K>,
): Promise<void> {
  const schema = userDataSchemas[key] as unknown as z.ZodType<UserDataValue<K>>;
  const clean = schema.parse(value);
  const updatedAt = new Date().toISOString();
  await cacheSet(cacheKey(user.uid, key), clean);
  await cacheSet(revisionKey(user.uid, key), updatedAt);
  try {
    if (!navigator.onLine) throw new Error('offline');
    await setDoc(dataRef(user.uid, key), { value: clean, updatedAt });
  } catch {
    await enqueue({
      id: `${user.uid}-${key}`,
      feature: 'user-data',
      operation: 'set',
      path: key,
      payload: { value: clean, updatedAt },
    });
  }
}

export async function flushUserDataQueue(user: User): Promise<number> {
  return flushQueue(
    async (item) => {
      if (
        item.feature !== 'user-data' ||
        item.operation !== 'set' ||
        !(item.path in userDataSchemas)
      )
        return;
      const key = item.path as UserDataKey;
      const payload = unwrapQueuedPayload(item.payload, item.createdAt);
      const clean = userDataSchemas[key].parse(payload.value);
      await setDoc(dataRef(user.uid, key), { value: clean, updatedAt: payload.updatedAt });
      await cacheSet(revisionKey(user.uid, key), payload.updatedAt);
    },
    Date.now(),
    (item) => item.id.startsWith(`${user.uid}-`),
  );
}

export function unwrapQueuedPayload(
  payload: unknown,
  createdAt: number,
): { value: unknown; updatedAt: string } {
  if (
    payload &&
    typeof payload === 'object' &&
    'value' in payload &&
    'updatedAt' in payload &&
    typeof payload.updatedAt === 'string'
  )
    return { value: payload.value, updatedAt: payload.updatedAt };
  return { value: payload, updatedAt: new Date(createdAt).toISOString() };
}
