import type { User } from 'firebase/auth';
import {
  deleteObject,
  getBytes,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from 'firebase/storage';
import { getFirebaseServices } from './firebase';
import { MAX_PHOTO_BYTES, photoFileName, validatePhoto } from '../features/photos/model';

function photoReference(user: User, id: string) {
  const services = getFirebaseServices();
  if (!services) throw new Error('firebase/unavailable');
  return ref(services.storage, `users/${user.uid}/photos/${photoFileName(id)}`);
}

export async function uploadPhoto(
  user: User,
  id: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  const validationError = validatePhoto(file);
  if (validationError) throw new Error(validationError);
  if (!navigator.onLine) throw new Error('photoOffline');
  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(photoReference(user, id), file, {
      contentType: 'image/jpeg',
      cacheControl: 'private,max-age=3600',
    });
    task.on(
      'state_changed',
      (snapshot) =>
        onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
      reject,
      () => resolve(),
    );
  });
}

export async function photoUrl(user: User, id: string): Promise<string> {
  return getDownloadURL(photoReference(user, id));
}

export async function downloadPhotoBytes(user: User, id: string): Promise<Uint8Array> {
  const buffer = await getBytes(photoReference(user, id), MAX_PHOTO_BYTES);
  return new Uint8Array(buffer);
}

export async function deletePhoto(user: User, id: string): Promise<void> {
  await deleteObject(photoReference(user, id));
}
