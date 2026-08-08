import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { z } from 'zod';
import { userDataSchemas, type UserDataKey } from '../domain/schemas';
import {
  cacheGet,
  cacheSet,
  conflictDelete,
  conflictPut,
  conflictsForUser,
  queueDelete,
  queueList,
} from './database';
import type { SyncConflict } from '../core/validation';
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
const remoteEnvelopeSchema = z.object({ value: z.unknown(), updatedAt: z.string().optional() });

const differs = (left: unknown, right: unknown) => JSON.stringify(left) !== JSON.stringify(right);
export function hasRemoteConflict(
  remoteUpdatedAt: unknown,
  baseUpdatedAt: string | undefined,
  remoteValue: unknown,
  localValue: unknown,
): remoteUpdatedAt is string {
  return (
    typeof remoteUpdatedAt === 'string' &&
    typeof baseUpdatedAt === 'string' &&
    remoteUpdatedAt > baseUpdatedAt &&
    differs(remoteValue, localValue)
  );
}

async function recordConflict<K extends UserDataKey>(
  user: User,
  key: K,
  localValue: UserDataValue<K>,
  localUpdatedAt: string,
  remoteValue: unknown,
  remoteUpdatedAt: string,
): Promise<void> {
  await conflictPut({
    id: `${user.uid}-${key}`,
    uid: user.uid,
    key,
    localValue,
    remoteValue,
    localUpdatedAt,
    remoteUpdatedAt,
    detectedAt: new Date().toISOString(),
  });
}

async function fetchAndCacheUserData<K extends UserDataKey>(
  user: User,
  key: K,
  schema: z.ZodType<UserDataValue<K>>,
): Promise<UserDataValue<K> | null> {
  const snapshot = await getDoc(dataRef(user.uid, key));
  if (!snapshot.exists()) return null;
  const result = schema.safeParse(snapshot.data().value);
  if (!result.success) throw new Error(`Invalid ${key} document`);
  await cacheSet(cacheKey(user.uid, key), result.data);
  if (typeof snapshot.data().updatedAt === 'string')
    await cacheSet(revisionKey(user.uid, key), snapshot.data().updatedAt);
  return result.data;
}

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
  if (cachedResult.success) {
    // Serve the cached value immediately so every navigation doesn't pay a
    // live Firestore round-trip on top of rendering — a save already wrote
    // this same cache moments before most reads, so it's rarely actually
    // stale. Refresh in the background purely to keep the NEXT read current
    // (e.g. after a change made on another device).
    void fetchAndCacheUserData(user, key, schema).catch(() => undefined);
    return cachedResult.data;
  }
  return fetchAndCacheUserData(user, key, schema);
}

export async function saveUserData<K extends UserDataKey>(
  user: User,
  key: K,
  value: UserDataValue<K>,
): Promise<void> {
  const schema = userDataSchemas[key] as unknown as z.ZodType<UserDataValue<K>>;
  const clean = schema.parse(value);
  const updatedAt = new Date().toISOString();
  const previousRevision = await cacheGet<string>(revisionKey(user.uid, key));
  await cacheSet(cacheKey(user.uid, key), clean);
  try {
    if (!navigator.onLine) throw new Error('offline');
    const remote = await getDoc(dataRef(user.uid, key));
    const remoteEnvelope = remoteEnvelopeSchema.safeParse(remote.data());
    const remoteUpdatedAt = remoteEnvelope.success ? remoteEnvelope.data.updatedAt : undefined;
    const remoteValue = remoteEnvelope.success ? remoteEnvelope.data.value : undefined;
    if (hasRemoteConflict(remoteUpdatedAt, previousRevision, remoteValue, clean)) {
      await recordConflict(user, key, clean, updatedAt, remoteValue, remoteUpdatedAt);
      throw new Error('syncConflict');
    }
    await setDoc(dataRef(user.uid, key), { value: clean, updatedAt });
    await cacheSet(revisionKey(user.uid, key), updatedAt);
  } catch {
    await enqueue({
      id: `${user.uid}-${key}`,
      feature: 'user-data',
      operation: 'set',
      path: key,
      payload: { value: clean, updatedAt, baseUpdatedAt: previousRevision },
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
      const remote = await getDoc(dataRef(user.uid, key));
      const remoteEnvelope = remoteEnvelopeSchema.safeParse(remote.data());
      const remoteUpdatedAt = remoteEnvelope.success ? remoteEnvelope.data.updatedAt : undefined;
      const remoteValue = remoteEnvelope.success ? remoteEnvelope.data.value : undefined;
      if (
        hasRemoteConflict(
          remoteUpdatedAt,
          payload.baseUpdatedAt ?? payload.updatedAt,
          remoteValue,
          clean,
        )
      ) {
        await recordConflict(user, key, clean, payload.updatedAt, remoteValue, remoteUpdatedAt);
        return;
      }
      await setDoc(dataRef(user.uid, key), { value: clean, updatedAt: payload.updatedAt });
      await cacheSet(revisionKey(user.uid, key), payload.updatedAt);
    },
    Date.now(),
    (item) => item.id.startsWith(`${user.uid}-`),
  );
}

export async function listSyncConflicts(user: User): Promise<SyncConflict[]> {
  return conflictsForUser(user.uid);
}

export async function resolveSyncConflict(
  user: User,
  conflict: SyncConflict,
  choice: 'local' | 'remote',
): Promise<void> {
  if (conflict.uid !== user.uid || !(conflict.key in userDataSchemas)) throw new Error('conflict');
  const key = conflict.key as UserDataKey;
  const schema = userDataSchemas[key] as unknown as z.ZodType<unknown>;
  const value = schema.parse(choice === 'local' ? conflict.localValue : conflict.remoteValue);
  const updatedAt = choice === 'local' ? new Date().toISOString() : conflict.remoteUpdatedAt;
  if (choice === 'local') await setDoc(dataRef(user.uid, key), { value, updatedAt });
  await cacheSet(cacheKey(user.uid, key), value);
  await cacheSet(revisionKey(user.uid, key), updatedAt);
  await queueDelete(`${user.uid}-${key}`);
  await conflictDelete(conflict.id);
}

export function unwrapQueuedPayload(
  payload: unknown,
  createdAt: number,
): { value: unknown; updatedAt: string; baseUpdatedAt?: string | undefined } {
  if (
    payload &&
    typeof payload === 'object' &&
    'value' in payload &&
    'updatedAt' in payload &&
    typeof payload.updatedAt === 'string'
  )
    return {
      value: payload.value,
      updatedAt: payload.updatedAt,
      baseUpdatedAt:
        'baseUpdatedAt' in payload && typeof payload.baseUpdatedAt === 'string'
          ? payload.baseUpdatedAt
          : undefined,
    };
  return { value: payload, updatedAt: new Date(createdAt).toISOString() };
}
