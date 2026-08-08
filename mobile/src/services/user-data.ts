import { hasRevisionConflict } from '@kyro/domain';
import { doc, getDoc, runTransaction } from 'firebase/firestore';
import type { z } from 'zod';

import { getMobileFirestore } from '@/services/firebase';
import {
  deletePendingWrite,
  pendingWrites,
  putPendingWrite,
  readUserCache,
  writeUserCache,
} from '@/services/local-data';

interface Envelope {
  value?: unknown;
  updatedAt?: string;
}

export class SyncConflictError extends Error {
  constructor(public readonly key: string) {
    super(`Remote data changed for ${key}`);
  }
}

export async function loadUserData<T>(
  uid: string,
  key: string,
  schema: z.ZodType<T>,
): Promise<T | null> {
  try {
    const snapshot = await getDoc(doc(getMobileFirestore(), 'users', uid, 'data', key));
    const envelope = snapshot.data() as Envelope | undefined;
    const parsed = schema.safeParse(envelope?.value);
    if (!parsed.success) return null;
    await writeUserCache(uid, key, parsed.data);
    if (envelope?.updatedAt) await writeUserCache(uid, `revision:${key}`, envelope.updatedAt);
    return parsed.data;
  } catch (cause) {
    const cached = schema.safeParse(await readUserCache(uid, key));
    if (cached.success) return cached.data;
    throw cause;
  }
}

async function commitWrite(
  uid: string,
  key: string,
  value: unknown,
  updatedAt: string,
  baseUpdatedAt?: string,
): Promise<void> {
  const reference = doc(getMobileFirestore(), 'users', uid, 'data', key);
  await runTransaction(getMobileFirestore(), async (transaction) => {
    const snapshot = await transaction.get(reference);
    const remote = snapshot.data() as Envelope | undefined;
    if (hasRevisionConflict(remote?.updatedAt, baseUpdatedAt, remote?.value, value))
      throw new SyncConflictError(key);
    transaction.set(reference, { value, updatedAt });
  });
}

export async function saveUserData<T>(
  uid: string,
  key: string,
  schema: z.ZodType<T>,
  value: T,
): Promise<'synced' | 'queued'> {
  const clean = schema.parse(value);
  const updatedAt = new Date().toISOString();
  const revision = await readUserCache(uid, `revision:${key}`);
  const baseUpdatedAt = typeof revision === 'string' ? revision : undefined;
  await writeUserCache(uid, key, clean);
  try {
    await commitWrite(uid, key, clean, updatedAt, baseUpdatedAt);
    await writeUserCache(uid, `revision:${key}`, updatedAt);
    await deletePendingWrite(uid, key);
    return 'synced';
  } catch (cause) {
    if (cause instanceof SyncConflictError) throw cause;
    await putPendingWrite({
      uid,
      key,
      value: clean,
      updatedAt,
      ...(baseUpdatedAt ? { baseUpdatedAt } : {}),
      attempts: 0,
    });
    return 'queued';
  }
}

export async function flushPendingWrites(uid: string): Promise<number> {
  let flushed = 0;
  for (const write of await pendingWrites(uid)) {
    try {
      await commitWrite(uid, write.key, write.value, write.updatedAt, write.baseUpdatedAt);
      await writeUserCache(uid, `revision:${write.key}`, write.updatedAt);
      await deletePendingWrite(uid, write.key);
      flushed += 1;
    } catch (cause) {
      if (cause instanceof SyncConflictError) throw cause;
      await putPendingWrite({ ...write, attempts: Math.min(write.attempts + 1, 10) });
    }
  }
  return flushed;
}
