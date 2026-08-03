import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getIdTokenResult, onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { getMobileAuth, getMobileFirestore } from '@/services/firebase';
import { clearUserCache } from '@/services/local-data';

export type AuthStatus = 'loading' | 'signed-out' | 'unverified' | 'blocked' | 'ready';
interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  isAdmin: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function requiresVerification(user: User): boolean {
  return (
    user.providerData.some(({ providerId }) => providerId === 'password') && !user.emailVerified
  );
}

async function resolveAccess(user: User): Promise<{ blocked: boolean; isAdmin: boolean }> {
  const reference = doc(getMobileFirestore(), 'sharedUsers', user.uid);
  const snapshot = await getDoc(reference);
  if (!snapshot.exists()) {
    await setDoc(reference, {
      email: user.email ?? '',
      createdAt: serverTimestamp(),
      blocked: false,
    });
  }
  const token = await getIdTokenResult(user);
  return { blocked: snapshot.data()?.blocked === true, isAdmin: token.claims.admin === true };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let generation = 0;
    return onAuthStateChanged(getMobileAuth(), (nextUser) => {
      const current = ++generation;
      setUser(nextUser);
      setIsAdmin(false);
      if (!nextUser) {
        setStatus('signed-out');
        return;
      }
      if (requiresVerification(nextUser)) {
        setStatus('unverified');
        return;
      }
      setStatus('loading');
      void resolveAccess(nextUser)
        .then((access) => {
          if (current !== generation) return;
          setIsAdmin(access.isAdmin);
          setStatus(access.blocked ? 'blocked' : 'ready');
        })
        .catch(() => {
          if (current === generation) void signOut(getMobileAuth());
        });
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isAdmin,
      logout: async () => {
        const uid = user?.uid;
        try {
          if (uid) await clearUserCache(uid);
        } finally {
          await signOut(getMobileAuth());
        }
      },
    }),
    [isAdmin, status, user],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
