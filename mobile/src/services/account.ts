import { EmailAuthProvider, reauthenticateWithCredential, type User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';

import { getMobileFunctions } from '@/services/firebase';
import { clearUserCache } from '@/services/local-data';

export function usesPassword(user: User): boolean {
  return user.providerData.some(({ providerId }) => providerId === 'password');
}

export async function deleteOwnAccount(user: User, password?: string): Promise<void> {
  if (usesPassword(user)) {
    if (!user.email || !password) throw new Error('passwordRequired');
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  }
  await httpsCallable(getMobileFunctions(), 'deleteOwnAccount')();
  await clearUserCache(user.uid);
}
