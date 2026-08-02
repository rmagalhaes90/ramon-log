import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { KyroError } from '../../core/errors';
import { getFirebaseServices } from '../../services/firebase';

export type AuthStatus = 'loading' | 'signed-out' | 'unverified' | 'blocked' | 'ready';
export interface AuthState { status: AuthStatus; user: User | null }
export type AuthListener = (state: AuthState) => void;

const configuredServices = getFirebaseServices();
if (!configuredServices) throw new KyroError('Firebase unavailable', 'firebase/unconfigured');
const services = configuredServices;

function requiresVerification(user: User): boolean {
  return user.providerData.some(({ providerId }) => providerId === 'password') && !user.emailVerified;
}

async function ensureSharedProfile(user: User): Promise<boolean> {
  const reference = doc(services.firestore, 'sharedUsers', user.uid);
  const snapshot = await getDoc(reference);
  if (!snapshot.exists()) {
    await setDoc(reference, {
      email: user.email ?? '',
      createdAt: serverTimestamp(),
      blocked: false,
    });
    return false;
  }
  return snapshot.data().blocked === true;
}

export function observeAuth(listener: AuthListener): () => void {
  listener({ status: 'loading', user: null });
  let generation = 0;
  return onAuthStateChanged(services.auth, (user) => {
    const current = ++generation;
    if (!user) { listener({ status: 'signed-out', user: null }); return; }
    if (requiresVerification(user)) { listener({ status: 'unverified', user }); return; }
    void ensureSharedProfile(user)
      .then((blocked) => {
        if (current === generation) listener({ status: blocked ? 'blocked' : 'ready', user });
      })
      .catch(() => {
        if (current === generation) listener({ status: 'signed-out', user: null });
      });
  });
}

export function passwordIsStrong(password: string): boolean {
  return password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
}

export async function loginWithPassword(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(services.auth, email.trim().toLowerCase().slice(0, 254), password.slice(0, 128));
}

export async function createAccount(email: string, password: string): Promise<void> {
  if (!passwordIsStrong(password)) throw new KyroError('Weak password', 'auth/weak-password');
  const credential = await createUserWithEmailAndPassword(services.auth, email.trim().toLowerCase().slice(0, 254), password.slice(0, 128));
  services.auth.languageCode = document.documentElement.lang;
  await sendEmailVerification(credential.user);
  sessionStorage.setItem('kyro-v4-new-account', credential.user.uid);
}

export async function loginWithGoogle(): Promise<void> {
  await signInWithPopup(services.auth, new GoogleAuthProvider());
}

export async function requestPasswordReset(email: string): Promise<void> {
  try { await sendPasswordResetEmail(services.auth, email.trim().toLowerCase().slice(0, 254)); }
  catch (error: unknown) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    if (code === 'auth/too-many-requests') throw error;
  }
}

export async function resendVerification(user: User): Promise<void> {
  const key = `kyro-v4-verify-${user.uid}`;
  const last = Number(localStorage.getItem(key)) || 0;
  if (Date.now() - last < 60_000) throw new KyroError('Verification cooldown', 'auth/too-many-requests');
  await sendEmailVerification(user);
  localStorage.setItem(key, String(Date.now()));
}

export async function refreshVerification(user: User): Promise<boolean> {
  await reload(user);
  return user.emailVerified;
}

export async function logout(): Promise<void> { await signOut(services.auth); }

export function authErrorKey(error: unknown): 'authInvalid' | 'authRate' | 'passwordHint' | 'authGeneric' {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  if (/invalid-credential|wrong-password|user-not-found/.test(code)) return 'authInvalid';
  if (code === 'auth/too-many-requests') return 'authRate';
  if (code === 'auth/weak-password') return 'passwordHint';
  return 'authGeneric';
}
