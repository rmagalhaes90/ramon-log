import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

initializeApp();
const bootstrapEmail = 'rmagalhaes90@gmail.com';

function requireUser(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required');
  return request.auth;
}

function requireAdmin(request) {
  const auth = requireUser(request);
  if (auth.token.admin !== true && auth.token.email !== bootstrapEmail)
    throw new HttpsError('permission-denied', 'Admin required');
  return auth;
}

export const setAdminRole = onCall({ invoker: 'public' }, async (request) => {
  const actor = requireAdmin(request);
  const { uid, isAdmin } = request.data ?? {};
  if (typeof uid !== 'string' || !uid || typeof isAdmin !== 'boolean')
    throw new HttpsError('invalid-argument', 'Invalid role request');
  const user = await getAuth().getUser(uid);
  if (!isAdmin && user.email?.toLowerCase() === bootstrapEmail)
    throw new HttpsError('failed-precondition', 'Bootstrap admin cannot be revoked');
  await getAuth().setCustomUserClaims(uid, { ...user.customClaims, admin: isAdmin });
  await getFirestore().doc(`sharedUsers/${uid}`).set({ isAdmin }, { merge: true });
  await getFirestore().collection('adminAudit').add({
    action: 'role',
    actorUid: actor.uid,
    targetUid: uid,
    value: isAdmin,
    at: FieldValue.serverTimestamp(),
  });
  return { uid, isAdmin };
});

export const setUserBlocked = onCall({ invoker: 'public' }, async (request) => {
  const actor = requireAdmin(request);
  const { uid, blocked } = request.data ?? {};
  if (typeof uid !== 'string' || !uid || typeof blocked !== 'boolean')
    throw new HttpsError('invalid-argument', 'Invalid block request');
  await getAuth().updateUser(uid, { disabled: blocked });
  await getFirestore().doc(`sharedUsers/${uid}`).set({ blocked }, { merge: true });
  await getFirestore().collection('adminAudit').add({
    action: 'blocked',
    actorUid: actor.uid,
    targetUid: uid,
    value: blocked,
    at: FieldValue.serverTimestamp(),
  });
  return { uid, blocked };
});

export const deleteOwnAccount = onCall({ invoker: 'public' }, async (request) => {
  const { uid } = requireUser(request);
  await getStorage()
    .bucket()
    .deleteFiles({ prefix: `users/${uid}/photos/`, force: true });
  await getFirestore().recursiveDelete(getFirestore().doc(`users/${uid}`));
  await getFirestore()
    .doc(`sharedUsers/${uid}`)
    .delete()
    .catch(() => undefined);
  await getAuth()
    .deleteUser(uid)
    .catch((error) => {
      if (error?.code !== 'auth/user-not-found') throw error;
    });
  return { deleted: true };
});

export const getEntitlements = onCall({ invoker: 'public' }, async (request) => {
  const { uid } = requireUser(request);
  const snapshot = await getFirestore().doc(`subscriptions/${uid}`).get();
  const data = snapshot.data() ?? {};
  const active = ['trialing', 'active', 'past_due_grace'].includes(data.status);
  const plan = active && ['pro', 'coach'].includes(data.plan) ? data.plan : 'free';
  const features =
    plan === 'coach'
      ? ['history', 'progression', 'reports', 'photos', 'coach']
      : plan === 'pro'
        ? ['history', 'progression', 'reports', 'photos']
        : ['history'];
  return { plan, status: active ? data.status : 'inactive', features };
});
