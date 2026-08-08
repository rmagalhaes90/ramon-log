import type { User } from 'firebase/auth';
import { dateKey } from '../workouts/model';
import { pendingPhotoDelete, pendingPhotoPut, pendingPhotos } from '../../services/database';
import { deletePhoto, uploadPhoto } from '../../services/photo-storage';
import { loadUserData, saveUserData } from '../../services/user-data';
import { validatePhoto } from './model';

export const MAX_PENDING_PHOTOS = 10;
export async function enqueuePhoto(user: User, id: string, file: File): Promise<void> {
  const error = validatePhoto(file);
  if (error) throw new Error(error);
  const pending = await pendingPhotos(user.uid);
  if (pending.length >= MAX_PENDING_PHOTOS) throw new Error('photoQueueFull');
  await pendingPhotoPut({ id, uid: user.uid, date: dateKey(), file, createdAt: Date.now() });
}
export async function photoQueueCount(user: User): Promise<number> {
  return (await pendingPhotos(user.uid)).length;
}
export async function flushPhotoUploads(user: User): Promise<number> {
  if (!navigator.onLine) return 0;
  const pending = (await pendingPhotos(user.uid)).sort((a, b) => a.createdAt - b.createdAt);
  let completed = 0;
  for (const item of pending) {
    try {
      const file = new File([item.file], `${item.id}.jpg`, { type: 'image/jpeg' });
      await uploadPhoto(user, item.id, file);
      const index = await loadUserData(user, 'photoIndex').then((value) => value ?? []);
      if (!index.some(({ id }) => id === item.id))
        await saveUserData(user, 'photoIndex', [...index, { id: item.id, d: item.date }]);
      await pendingPhotoDelete(item.id);
      completed++;
    } catch (error) {
      try {
        await deletePhoto(user, item.id);
      } catch {
        /* Upload may not have completed. */
      }
      throw error;
    }
  }
  return completed;
}
