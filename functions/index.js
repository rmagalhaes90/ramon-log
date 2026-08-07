import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

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

function requireAdminOrCoach(request) {
  const auth = requireUser(request);
  if (auth.token.admin !== true && auth.token.coach !== true && auth.token.email !== bootstrapEmail)
    throw new HttpsError('permission-denied', 'Admin or coach required');
  return auth;
}

// Looks up the target Auth user for an admin action. If the account was
// deleted directly (e.g. from the Firebase console) but its sharedUsers
// doc was left behind, this self-heals by removing the stale doc instead
// of surfacing a raw auth/user-not-found error to the caller.
async function getAuthUserOrCleanStale(uid) {
  try {
    return await getAuth().getUser(uid);
  } catch (error) {
    if (error?.code === 'auth/user-not-found') {
      await getFirestore()
        .doc(`sharedUsers/${uid}`)
        .delete()
        .catch(() => undefined);
      throw new HttpsError(
        'not-found',
        'This user no longer exists and was removed from the list.',
      );
    }
    throw error;
  }
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
  const user = await getAuthUserOrCleanStale(uid);
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
  const user = await getAuthUserOrCleanStale(uid);
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
  await getAuthUserOrCleanStale(uid);
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

const rapidApiKey = defineSecret('RAPIDAPI_KEY');
const EXERCISE_MEDIA_HOST = 'edb-with-gifs-and-images-by-ascendapi.p.rapidapi.com';

async function exerciseMediaRequest(path) {
  const response = await fetch(`https://${EXERCISE_MEDIA_HOST}${path}`, {
    headers: {
      'x-rapidapi-host': EXERCISE_MEDIA_HOST,
      'x-rapidapi-key': rapidApiKey.value(),
    },
  });
  if (!response.ok) throw new HttpsError('unavailable', 'Exercise media provider request failed');
  return response.json();
}

// Coaches/admins search this to find the right reference GIF/image for a
// catalog exercise once, in the Exercise Manager; the RapidAPI key never
// reaches the client, only the resulting exerciseId is stored on the
// exercise (see exerciseDbId in domain/schemas.ts).
export const searchExerciseMedia = onCall(
  { invoker: 'public', secrets: [rapidApiKey] },
  async (request) => {
    requireAdminOrCoach(request);
    const query =
      typeof request.data?.query === 'string' ? request.data.query.trim().slice(0, 100) : '';
    if (!query) throw new HttpsError('invalid-argument', 'Search query required');
    const body = await exerciseMediaRequest(
      `/api/v1/exercises/search?search=${encodeURIComponent(query)}`,
    );
    const results = Array.isArray(body?.data) ? body.data : [];
    return {
      results: results.slice(0, 20).map((item) => ({
        exerciseId: String(item.exerciseId ?? ''),
        name: String(item.name ?? ''),
        imageUrl: String(item.imageUrl ?? ''),
      })),
    };
  },
);

// Any signed-in user can resolve an already-linked exerciseId to its GIF,
// since students see it while training. Cached in Firestore so repeat
// views of the same popular exercise don't re-bill the RapidAPI quota.
export const getExerciseMedia = onCall(
  { invoker: 'public', secrets: [rapidApiKey] },
  async (request) => {
    requireUser(request);
    const exerciseId =
      typeof request.data?.exerciseId === 'string'
        ? request.data.exerciseId.trim().slice(0, 60)
        : '';
    if (!exerciseId) throw new HttpsError('invalid-argument', 'exerciseId required');
    const cacheRef = getFirestore().doc(`sharedExerciseMedia/${exerciseId}`);
    const cached = await cacheRef.get();
    if (cached.exists) {
      const cachedData = cached.data();
      return {
        exerciseId: cachedData.exerciseId,
        name: cachedData.name,
        gifUrl: cachedData.gifUrl,
        imageUrl: cachedData.imageUrl,
      };
    }
    const body = await exerciseMediaRequest(`/api/v1/exercises/${encodeURIComponent(exerciseId)}`);
    const data = body?.data ?? {};
    const media = {
      exerciseId,
      name: String(data.name ?? ''),
      gifUrl: String(data.gifUrls?.['480p'] ?? Object.values(data.gifUrls ?? {})[0] ?? ''),
      imageUrl: String(data.imageUrls?.['480p'] ?? Object.values(data.imageUrls ?? {})[0] ?? ''),
    };
    await cacheRef.set({ ...media, cachedAt: FieldValue.serverTimestamp() });
    return media;
  },
);
