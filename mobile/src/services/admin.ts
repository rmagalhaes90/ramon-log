import { collection, getDocs, limit, orderBy, query, type Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { z } from 'zod';

import { getMobileFirestore, getMobileFunctions } from '@/services/firebase';

const sharedUserSchema = z.object({
  email: z.string().email().or(z.literal('')),
  blocked: z.boolean().default(false),
  isAdmin: z.boolean().default(false),
});
export interface SharedUser extends z.infer<typeof sharedUserSchema> {
  uid: string;
}
export interface AuditEntry {
  id: string;
  action: string;
  actorUid: string;
  targetUid: string;
  value: boolean;
  at: string;
}

export async function listSharedUsers(): Promise<SharedUser[]> {
  const snapshot = await getDocs(
    query(collection(getMobileFirestore(), 'sharedUsers'), limit(100)),
  );
  return snapshot.docs.flatMap((item) => {
    const parsed = sharedUserSchema.safeParse(item.data());
    return parsed.success ? [{ uid: item.id, ...parsed.data }] : [];
  });
}

export async function listAdminAudit(): Promise<AuditEntry[]> {
  const snapshot = await getDocs(
    query(collection(getMobileFirestore(), 'adminAudit'), orderBy('at', 'desc'), limit(50)),
  );
  return snapshot.docs.flatMap((item) => {
    const data = item.data() as {
      action?: unknown;
      actorUid?: unknown;
      targetUid?: unknown;
      value?: unknown;
      at?: Timestamp;
    };
    return typeof data.action === 'string' &&
      typeof data.actorUid === 'string' &&
      typeof data.targetUid === 'string' &&
      typeof data.value === 'boolean'
      ? [
          {
            id: item.id,
            action: data.action,
            actorUid: data.actorUid,
            targetUid: data.targetUid,
            value: data.value,
            at: data.at?.toDate().toISOString() ?? '',
          },
        ]
      : [];
  });
}

export async function setUserBlocked(uid: string, blocked: boolean): Promise<void> {
  await httpsCallable(getMobileFunctions(), 'setUserBlocked')({ uid, blocked });
}

export async function setUserAdmin(uid: string, isAdmin: boolean): Promise<void> {
  await httpsCallable(getMobileFunctions(), 'setAdminRole')({ uid, isAdmin });
}
