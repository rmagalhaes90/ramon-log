import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebaseServices } from '../../services/firebase';

export type AuthState = { status: 'unconfigured' | 'signed-out' | 'unverified' | 'ready'; user: User | null };

export function observeAuth(listener: (state: AuthState) => void): () => void {
  const services = getFirebaseServices();
  if (!services) {
    listener({ status: 'unconfigured', user: null });
    return () => undefined;
  }
  return onAuthStateChanged(services.auth, (user) => {
    if (!user) listener({ status: 'signed-out', user: null });
    else if (user.providerData.some(({ providerId }) => providerId === 'password') && !user.emailVerified)
      listener({ status: 'unverified', user });
    else listener({ status: 'ready', user });
  });
}
