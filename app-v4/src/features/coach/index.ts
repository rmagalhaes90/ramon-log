import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { z } from 'zod';
import { getFirebaseServices } from '../../services/firebase';

function services() {
  const value = getFirebaseServices();
  if (!value) throw new Error('firebase/unavailable');
  return value;
}

export async function createInvite(): Promise<{ code: string; expiresAt: number }> {
  const result = await httpsCallable(services().functions, 'createCoachInvite')();
  return result.data as { code: string; expiresAt: number };
}

export async function redeemInvite(code: string): Promise<{ coachUid: string }> {
  const result = await httpsCallable(services().functions, 'redeemCoachInvite')({ code });
  return result.data as { coachUid: string };
}

export async function leaveCoachRelationship(): Promise<{ left: boolean }> {
  const result = await httpsCallable(services().functions, 'leaveCoach')();
  return result.data as { left: boolean };
}

const studentSchema = z.object({ email: z.string().default('') });
export interface CoachStudent {
  uid: string;
  email: string;
}

export async function listCoachStudents(coachUid: string): Promise<CoachStudent[]> {
  const snapshot = await getDocs(collection(services().firestore, 'coaches', coachUid, 'students'));
  return snapshot.docs.map((item) => {
    const result = studentSchema.safeParse(item.data());
    return { uid: item.id, email: result.success ? result.data.email : '' };
  });
}

const coachOfSchema = z.object({ coachUid: z.string(), coachEmail: z.string().default('') });
export interface CoachLink {
  coachUid: string;
  coachEmail: string;
}

export async function myCoach(uid: string): Promise<CoachLink | null> {
  const snapshot = await getDoc(doc(services().firestore, 'coachOf', uid));
  if (!snapshot.exists()) return null;
  const result = coachOfSchema.safeParse(snapshot.data());
  return result.success ? result.data : null;
}
