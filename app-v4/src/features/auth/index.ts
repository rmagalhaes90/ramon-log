import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  GoogleAuthProvider,
  OAuthProvider,
  getIdTokenResult,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
  verifyPasswordResetCode,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { KyroError, reportBackgroundError } from '../../core/errors';
import { getFirebaseServices } from '../../services/firebase';

export type AuthStatus = 'loading' | 'signed-out' | 'unverified' | 'blocked' | 'ready';
export interface AuthState {
  status: AuthStatus;
  user: User | null;
  isAdmin: boolean;
  isCoach: boolean;
}
export type AuthListener = (state: AuthState) => void;

const configuredServices = getFirebaseServices();
if (!configuredServices) throw new KyroError('Firebase unavailable', 'firebase/unconfigured');
const services = configuredServices;

// Mirrors the bootstrap-admin bypass already present in firestore.rules
// (isSuperAdmin) and functions/index.js (requireAdmin) — this account is
// always treated as admin even before the `admin` custom claim is set.
const bootstrapEmail = 'rmagalhaes90@gmail.com';
function isBootstrapAdmin(user: User): boolean {
  return user.email?.toLowerCase() === bootstrapEmail;
}

export type EmailActionMode = 'resetPassword' | 'recoverEmail' | 'verifyEmail';

export interface EmailActionRequest {
  mode: EmailActionMode;
  code: string;
  continueUrl?: string;
}

function authLocale(): 'pt' | 'en' {
  return document.documentElement.lang.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

function appReturnUrl(): string {
  const url = new URL(document.baseURI);
  url.search = '';
  url.hash = '';
  return url.href;
}

function emailActionSettings() {
  return { url: appReturnUrl(), handleCodeInApp: false } as const;
}

export function parseEmailAction(search: string): EmailActionRequest | null {
  const query = new URLSearchParams(search);
  const mode = query.get('mode');
  const code = query.get('oobCode')?.trim();
  if (!code || !['resetPassword', 'recoverEmail', 'verifyEmail'].includes(mode ?? '')) return null;
  const continueUrl = query.get('continueUrl') ?? undefined;
  return continueUrl
    ? { mode: mode as EmailActionMode, code, continueUrl }
    : { mode: mode as EmailActionMode, code };
}

export async function verifyEmailActionCode(code: string): Promise<void> {
  await checkActionCode(services.auth, code);
}

export async function completeEmailAction(code: string): Promise<void> {
  await applyActionCode(services.auth, code);
}

export async function verifyResetActionCode(code: string): Promise<string> {
  return verifyPasswordResetCode(services.auth, code);
}

export async function completePasswordReset(code: string, password: string): Promise<void> {
  if (!passwordIsStrong(password)) throw new KyroError('Weak password', 'auth/weak-password');
  await confirmPasswordReset(services.auth, code, password.slice(0, 128));
}

function requiresVerification(user: User): boolean {
  return (
    user.providerData.some(({ providerId }) => providerId === 'password') && !user.emailVerified
  );
}

async function ensureSharedProfile(
  user: User,
): Promise<{ blocked: boolean; isAdmin: boolean; isCoach: boolean }> {
  const reference = doc(services.firestore, 'sharedUsers', user.uid);
  const snapshot = await getDoc(reference);
  if (!snapshot.exists()) {
    await setDoc(reference, {
      email: user.email ?? '',
      createdAt: serverTimestamp(),
      blocked: false,
    });
    const token = await getIdTokenResult(user);
    return {
      blocked: false,
      isAdmin: isBootstrapAdmin(user) || token.claims.admin === true,
      isCoach: token.claims.coach === true,
    };
  }
  const data = snapshot.data();
  const token = await getIdTokenResult(user);
  return {
    blocked: data.blocked === true,
    isAdmin: isBootstrapAdmin(user) || token.claims.admin === true,
    isCoach: token.claims.coach === true,
  };
}

async function retryEnsureSharedProfile(
  user: User,
  deadline: number,
  delayMs = 1000,
): Promise<{ blocked: boolean; isAdmin: boolean; isCoach: boolean }> {
  try {
    return await ensureSharedProfile(user);
  } catch (error) {
    reportBackgroundError(error, 'auth/shared-profile-retry');
    if (Date.now() >= deadline) throw error;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return retryEnsureSharedProfile(user, deadline, Math.min(delayMs * 2, 5000));
  }
}

export function observeAuth(listener: AuthListener): () => void {
  listener({ status: 'loading', user: null, isAdmin: false, isCoach: false });
  let generation = 0;
  return onAuthStateChanged(services.auth, (user) => {
    const current = ++generation;
    if (!user) {
      listener({ status: 'signed-out', user: null, isAdmin: false, isCoach: false });
      return;
    }
    if (requiresVerification(user)) {
      listener({ status: 'unverified', user, isAdmin: false, isCoach: false });
      return;
    }
    // Firestore can briefly report itself offline right after a fresh
    // sign-in (before its first successful round-trip), which would
    // otherwise bounce a legitimately signed-in user back to the login
    // screen with no explanation. Retrying with backoff for up to a
    // minute absorbs that transient state without waiting indefinitely
    // on a real outage.
    void retryEnsureSharedProfile(user, Date.now() + 60000)
      .then(({ blocked, isAdmin, isCoach }) => {
        if (current === generation)
          listener({ status: blocked ? 'blocked' : 'ready', user, isAdmin, isCoach });
      })
      .catch(() => {
        if (current === generation)
          listener({ status: 'signed-out', user: null, isAdmin: false, isCoach: false });
      });
  });
}

export function passwordIsStrong(password: string): boolean {
  return (
    password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password)
  );
}

export async function loginWithPassword(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(
    services.auth,
    email.trim().toLowerCase().slice(0, 254),
    password.slice(0, 128),
  );
}

export async function createAccount(email: string, password: string): Promise<void> {
  if (!passwordIsStrong(password)) throw new KyroError('Weak password', 'auth/weak-password');
  const credential = await createUserWithEmailAndPassword(
    services.auth,
    email.trim().toLowerCase().slice(0, 254),
    password.slice(0, 128),
  );
  services.auth.languageCode = authLocale();
  sessionStorage.setItem('kyro-v4-new-account', credential.user.uid);
  // The account already exists at this point (createUserWithEmailAndPassword
  // succeeded above) — a transient failure sending the verification email
  // (rate limit, quota, flaky network) must not surface as "signup failed"
  // and strand the user on the form. onAuthStateChanged will still route
  // them to the verify-email screen, where "Send again" retries this.
  try {
    await sendEmailVerification(credential.user, emailActionSettings());
  } catch (error) {
    reportBackgroundError(error, 'auth/verification-email-on-signup');
  }
}

export async function loginWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithPopup(services.auth, provider);
}

export async function loginWithApple(): Promise<void> {
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  await signInWithPopup(services.auth, provider);
}

export async function requestPasswordReset(email: string): Promise<void> {
  try {
    services.auth.languageCode = authLocale();
    await sendPasswordResetEmail(
      services.auth,
      email.trim().toLowerCase().slice(0, 254),
      emailActionSettings(),
    );
  } catch (error: unknown) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    if (code === 'auth/too-many-requests') throw error;
  }
}

export async function resendVerification(user: User): Promise<void> {
  const key = `kyro-v4-verify-${user.uid}`;
  const last = Number(localStorage.getItem(key)) || 0;
  if (Date.now() - last < 60_000)
    throw new KyroError('Verification cooldown', 'auth/too-many-requests');
  services.auth.languageCode = authLocale();
  await sendEmailVerification(user, emailActionSettings());
  localStorage.setItem(key, String(Date.now()));
}

export async function refreshVerification(user: User): Promise<boolean> {
  await reload(user);
  return user.emailVerified;
}

export async function logout(): Promise<void> {
  await signOut(services.auth);
}

export function authErrorKey(
  error: unknown,
): 'authInvalid' | 'authRate' | 'passwordHint' | 'authEmailInUse' | 'authGeneric' {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  if (/invalid-credential|wrong-password|user-not-found/.test(code)) return 'authInvalid';
  if (code === 'auth/too-many-requests') return 'authRate';
  if (code === 'auth/weak-password') return 'passwordHint';
  if (code === 'auth/email-already-in-use') return 'authEmailInUse';
  return 'authGeneric';
}
