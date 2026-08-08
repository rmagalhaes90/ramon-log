import assert from 'node:assert/strict';
import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

assert.equal(
  process.env.FIREBASE_AUTH_EMULATOR_HOST,
  '127.0.0.1:9099',
  'Refusing to run without the local Auth Emulator',
);

const app = initializeApp({ apiKey: 'demo-key', projectId: 'demo-kyro-v4' });
const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

const email = `kyro-${Date.now()}@example.test`;
const password = 'LocalOnlyPassword1';
const created = await createUserWithEmailAndPassword(auth, email, password);
assert.equal(created.user.email, email);
assert.equal(created.user.emailVerified, false);

await signOut(auth);
const signedIn = await signInWithEmailAndPassword(auth, email, password);
assert.equal(signedIn.user.uid, created.user.uid);
await deleteUser(signedIn.user);

console.log('Auth Emulator: create, sign-in and delete passed');
