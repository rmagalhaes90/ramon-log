import assert from 'node:assert/strict';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

for (const name of [
  'FIREBASE_AUTH_EMULATOR_HOST',
  'FIRESTORE_EMULATOR_HOST',
  'FIREBASE_STORAGE_EMULATOR_HOST',
]) {
  assert.ok(process.env[name], `Refusing to run without ${name}`);
}

initializeApp({ projectId: 'demo-kyro-v4' });
const identityBase =
  'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo';
const callableBase = 'http://127.0.0.1:5001/demo-kyro-v4/us-central1';

async function signUp(email) {
  const response = await fetch(identityBase, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'LocalOnlyPassword1', returnSecureToken: true }),
  });
  if (!response.ok) assert.fail(await response.text());
  return response.json();
}

async function call(name, token, data = {}) {
  const response = await fetch(`${callableBase}/${name}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ data }),
  });
  const payload = await response.json();
  assert.equal(response.ok, true, JSON.stringify(payload));
  return payload.result;
}

const bootstrap = await signUp('rmagalhaes90@gmail.com');
const target = await signUp(`target-${Date.now()}@example.test`);
await call('setAdminRole', bootstrap.idToken, { uid: target.localId, isAdmin: true });
assert.equal((await getAuth().getUser(target.localId)).customClaims?.admin, true);

await call('setUserBlocked', bootstrap.idToken, { uid: target.localId, blocked: true });
assert.equal((await getAuth().getUser(target.localId)).disabled, true);

const coachTarget = await signUp(`coach-${Date.now()}@example.test`);
await call('setCoachRole', bootstrap.idToken, { uid: coachTarget.localId, isCoach: true });
assert.equal((await getAuth().getUser(coachTarget.localId)).customClaims?.coach, true);
await call('setCoachRole', bootstrap.idToken, { uid: coachTarget.localId, isCoach: false });
assert.equal((await getAuth().getUser(coachTarget.localId)).customClaims?.coach, false);

const entitlements = await call('getEntitlements', bootstrap.idToken);
assert.deepEqual(entitlements, { plan: 'free', status: 'inactive', features: ['history'] });

const disposable = await signUp(`delete-${Date.now()}@example.test`);
await call('deleteOwnAccount', disposable.idToken);
await assert.rejects(getAuth().getUser(disposable.localId), /no user record|user-not-found/i);

console.log('Functions Emulator: claims, blocking and idempotent deletion passed');
