import { doc, getDoc, setDoc } from 'firebase/firestore';
import { z } from 'zod';
import { exerciseSchema, type Exercise } from '../../domain/schemas';
import { cacheGet, cacheSet } from '../../services/database';
import { getFirebaseServices } from '../../services/firebase';
import { exerciseCatalog } from './index';

const sharedExerciseDbSchema = z.object({
  exercises: exerciseSchema.array().max(500),
  updatedAt: z.string().optional(),
});
const CACHE_KEY = 'shared:exerciseDatabase';

function sharedExerciseDbRef() {
  const services = getFirebaseServices();
  if (!services) throw new Error('firebase/unavailable');
  return doc(services.firestore, 'shared', 'exerciseDatabase');
}

function replaceCatalog(exercises: Exercise[]): void {
  exerciseCatalog.splice(0, exerciseCatalog.length, ...exercises);
}

export async function loadSharedExerciseCatalog(): Promise<void> {
  try {
    const snapshot = await getDoc(sharedExerciseDbRef());
    if (snapshot.exists()) {
      const result = sharedExerciseDbSchema.safeParse(snapshot.data());
      if (result.success && result.data.exercises.length) {
        replaceCatalog(result.data.exercises);
        await cacheSet(CACHE_KEY, result.data.exercises);
      }
    }
  } catch {
    const cached = await cacheGet<unknown>(CACHE_KEY);
    const result = exerciseSchema.array().safeParse(cached);
    if (result.success && result.data.length) replaceCatalog(result.data);
  }
}

export async function saveSharedExerciseCatalog(exercises: Exercise[]): Promise<void> {
  const clean = exerciseSchema.array().max(500).parse(exercises);
  await setDoc(sharedExerciseDbRef(), { exercises: clean, updatedAt: new Date().toISOString() });
  replaceCatalog(clean);
  await cacheSet(CACHE_KEY, clean);
}
