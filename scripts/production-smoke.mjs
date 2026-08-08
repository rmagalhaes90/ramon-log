import { randomBytes, randomUUID } from 'node:crypto';

const project = 'traincontrollog';
const bucket = 'traincontrollog.firebasestorage.app';
const apiKey = 'AIzaSyDt-u1QOFEnCsoJmf1mXd31AOfSyQBtMZY';
const identity = `https://identitytoolkit.googleapis.com/v1/accounts`;
const callables = `https://us-central1-${project}.cloudfunctions.net`;
const email = `kyro-smoke-${randomUUID()}@example.invalid`;
const password = `Kyr0-${randomBytes(24).toString('base64url')}`;
let uid;
let idToken;
let deleted = false;

const jsonRequest = async (url, init = {}, expected = [200]) => {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!expected.includes(response.status))
    throw new Error(`${response.status} ${body.error?.message ?? text}`);
  return { body, status: response.status };
};

try {
  const signup = await jsonRequest(`${identity}:signUp?key=${apiKey}`, {
    method: 'POST',
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  uid = signup.body.localId;
  idToken = signup.body.idToken;
  if (!uid || !idToken) throw new Error('Auth signup did not return credentials');
  console.log('auth=create-ok');

  const firestoreDocument = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/users/${uid}/data/productionSmoke`;
  const firestoreHeaders = { authorization: `Bearer ${idToken}` };
  await jsonRequest(firestoreDocument, {
    method: 'PATCH',
    headers: firestoreHeaders,
    body: JSON.stringify({
      fields: {
        value: { mapValue: { fields: { smoke: { booleanValue: true } } } },
        updatedAt: { stringValue: new Date().toISOString() },
      },
    }),
  });
  const read = await jsonRequest(firestoreDocument, { headers: firestoreHeaders });
  if (read.body.fields?.value?.mapValue?.fields?.smoke?.booleanValue !== true)
    throw new Error('Firestore smoke value mismatch');
  console.log('firestore=write-read-ok');

  const photoPath = `users/${uid}/photos/production-smoke.jpg`;
  const upload = await fetch(
    `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(photoPath)}`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${idToken}`, 'content-type': 'image/jpeg' },
      body: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    },
  );
  if (!upload.ok) throw new Error(`Storage ${upload.status} ${await upload.text()}`);
  console.log('storage=upload-ok');

  const callableHeaders = { authorization: `Bearer ${idToken}` };
  const entitlement = await jsonRequest(`${callables}/getEntitlements`, {
    method: 'POST',
    headers: callableHeaders,
    body: JSON.stringify({ data: {} }),
  });
  if (entitlement.body.result?.plan !== 'free') throw new Error('Unexpected entitlement result');
  console.log('entitlements=authenticated-ok');

  const denied = await jsonRequest(
    `${callables}/setAdminRole`,
    {
      method: 'POST',
      headers: callableHeaders,
      body: JSON.stringify({ data: { uid, isAdmin: true } }),
    },
    [403],
  );
  if (denied.body.error?.status !== 'PERMISSION_DENIED')
    throw new Error('Non-admin request was not denied');
  console.log('admin=permission-denied-ok');

  const deletion = await jsonRequest(`${callables}/deleteOwnAccount`, {
    method: 'POST',
    headers: callableHeaders,
    body: JSON.stringify({ data: {} }),
  });
  if (deletion.body.result?.deleted !== true) throw new Error('Account deletion was not confirmed');
  deleted = true;
  console.log('account=delete-ok');
} finally {
  if (!deleted && idToken) {
    await fetch(`${identity}:delete?key=${apiKey}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }).catch(() => undefined);
    console.log('cleanup=fallback-requested');
  }
}
