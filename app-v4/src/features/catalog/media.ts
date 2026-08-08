import { httpsCallable } from 'firebase/functions';
import { getFirebaseServices } from '../../services/firebase';

function services() {
  const value = getFirebaseServices();
  if (!value) throw new Error('firebase/unavailable');
  return value;
}

export interface ExerciseMediaResult {
  exerciseId: string;
  name: string;
  imageUrl: string;
}

export async function searchExerciseMedia(query: string): Promise<ExerciseMediaResult[]> {
  const result = await httpsCallable(services().functions, 'searchExerciseMedia')({ query });
  const data = result.data as { results?: ExerciseMediaResult[] };
  return data.results ?? [];
}

export interface ExerciseMedia {
  exerciseId: string;
  name: string;
  gifUrl: string;
  imageUrl: string;
}

const mediaCache = new Map<string, Promise<ExerciseMedia>>();

export function getExerciseMedia(exerciseId: string): Promise<ExerciseMedia> {
  const cached = mediaCache.get(exerciseId);
  if (cached) return cached;
  const request = httpsCallable(
    services().functions,
    'getExerciseMedia',
  )({ exerciseId }).then((result) => result.data as ExerciseMedia);
  mediaCache.set(exerciseId, request);
  request.catch(() => mediaCache.delete(exerciseId));
  return request;
}
