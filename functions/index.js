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

function requireCoach(request) {
  const auth = requireUser(request);
  if (auth.token.coach !== true) throw new HttpsError('permission-denied', 'Coach required');
  return auth;
}

const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateInviteCode() {
  let code = '';
  for (let i = 0; i < 6; i += 1)
    code += INVITE_CODE_ALPHABET[Math.floor(Math.random() * INVITE_CODE_ALPHABET.length)];
  return code;
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

export const setCoachRole = onCall({ invoker: 'public' }, async (request) => {
  const actor = requireAdmin(request);
  const { uid, isCoach } = request.data ?? {};
  if (typeof uid !== 'string' || !uid || typeof isCoach !== 'boolean')
    throw new HttpsError('invalid-argument', 'Invalid role request');
  const user = await getAuth().getUser(uid);
  await getAuth().setCustomUserClaims(uid, { ...user.customClaims, coach: isCoach });
  await getFirestore().doc(`sharedUsers/${uid}`).set({ isCoach }, { merge: true });
  await getFirestore().collection('adminAudit').add({
    action: 'coachRole',
    actorUid: actor.uid,
    targetUid: uid,
    value: isCoach,
    at: FieldValue.serverTimestamp(),
  });
  return { uid, isCoach };
});

export const createCoachInvite = onCall({ invoker: 'public' }, async (request) => {
  const actor = requireCoach(request);
  const code = generateInviteCode();
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  await getFirestore()
    .doc(`coachInvites/${code}`)
    .set({ coachUid: actor.uid, createdAt: FieldValue.serverTimestamp(), expiresAt });
  return { code, expiresAt };
});

export const redeemCoachInvite = onCall({ invoker: 'public' }, async (request) => {
  const { uid } = requireUser(request);
  const { code } = request.data ?? {};
  if (typeof code !== 'string' || !code) throw new HttpsError('invalid-argument', 'Invalid code');
  const inviteRef = getFirestore().doc(`coachInvites/${code.toUpperCase()}`);
  const invite = await inviteRef.get();
  if (!invite.exists) throw new HttpsError('not-found', 'Invite code not found');
  const { coachUid, expiresAt } = invite.data();
  if (typeof expiresAt === 'number' && Date.now() > expiresAt) {
    await inviteRef.delete();
    throw new HttpsError('failed-precondition', 'Invite code expired');
  }
  if (coachUid === uid) throw new HttpsError('failed-precondition', 'Cannot link to yourself');
  const linkedAt = FieldValue.serverTimestamp();
  const student = await getAuth().getUser(uid);
  const coachUser = await getAuth().getUser(coachUid);
  await Promise.all([
    getFirestore()
      .doc(`coaches/${coachUid}/students/${uid}`)
      .set({ linkedAt, email: student.email ?? '' }),
    getFirestore()
      .doc(`coachOf/${uid}`)
      .set({ coachUid, linkedAt, coachEmail: coachUser.email ?? '' }),
    inviteRef.delete(),
  ]);
  return { coachUid };
});

export const leaveCoach = onCall({ invoker: 'public' }, async (request) => {
  const { uid } = requireUser(request);
  const linkRef = getFirestore().doc(`coachOf/${uid}`);
  const link = await linkRef.get();
  if (!link.exists) return { left: false };
  const { coachUid } = link.data();
  await Promise.all([
    linkRef.delete(),
    getFirestore().doc(`coaches/${coachUid}/students/${uid}`).delete(),
  ]);
  return { left: true };
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
