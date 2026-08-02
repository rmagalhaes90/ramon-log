import {
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  type User,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseServices } from '../../services/firebase';

export type DeletionStage = 'reauth' | 'storage' | 'firestore' | 'profile' | 'account';
export interface DeleteAccountOptions {
  password?: string;
  onStage?: (stage: DeletionStage) => void;
}

async function reauthenticate(user: User, password?: string): Promise<void> {
  const passwordProvider = user.providerData.some(({ providerId }) => providerId === 'password');
  if (passwordProvider) {
    if (!user.email || !password) throw new Error('auth/password-required');
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  } else await reauthenticateWithPopup(user, new GoogleAuthProvider());
}

export async function deleteOwnAccount(
  user: User,
  options: DeleteAccountOptions = {},
): Promise<void> {
  const services = getFirebaseServices();
  if (!services) throw new Error('firebase/unavailable');
  options.onStage?.('reauth');
  await reauthenticate(user, options.password);
  options.onStage?.('storage');
  const remove = httpsCallable(services.functions, 'deleteOwnAccount');
  options.onStage?.('firestore');
  await remove();
  options.onStage?.('profile');
  options.onStage?.('account');
}
