import { doc, getDoc } from 'firebase/firestore';
import type { z } from 'zod';

import { getMobileFirestore } from '@/services/firebase';
import { readUserCache, writeUserCache } from '@/services/local-data';

interface Envelope {
  value?: unknown;
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
    return parsed.data;
  } catch (cause) {
    const cached = schema.safeParse(await readUserCache(uid, key));
    if (cached.success) return cached.data;
    throw cause;
  }
}
