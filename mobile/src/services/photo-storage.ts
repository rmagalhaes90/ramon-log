import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { getMobileStorage } from '@/services/firebase';

const MAX_BYTES = 3 * 1024 * 1024;
const queueKey = (uid: string) => `@kyro:photo-queue:${uid}`;

export interface PendingPhoto {
  id: string;
  date: string;
  uri: string;
}

async function readQueue(uid: string): Promise<PendingPhoto[]> {
  const raw = await AsyncStorage.getItem(queueKey(uid));
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? (value as PendingPhoto[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(uid: string, queue: PendingPhoto[]): Promise<void> {
  await AsyncStorage.setItem(queueKey(uid), JSON.stringify(queue.slice(-10)));
}

export async function preparePhoto(uid: string, id: string, sourceUri: string): Promise<File> {
  const result = await manipulateAsync(sourceUri, [{ resize: { width: 1920 } }], {
    compress: 0.8,
    format: SaveFormat.JPEG,
  });
  const directory = new Directory(Paths.document, 'kyro-photos', uid);
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  const destination = new File(directory, `${id}.jpg`);
  if (destination.exists) destination.delete();
  await new File(result.uri).copy(destination);
  if (!destination.size || destination.size > MAX_BYTES) {
    destination.delete();
    throw new Error('photoSize');
  }
  return destination;
}

export async function enqueuePhoto(uid: string, photo: PendingPhoto): Promise<void> {
  const queue = await readQueue(uid);
  if (queue.length >= 10) throw new Error('photoQueueFull');
  await writeQueue(uid, [...queue.filter((item) => item.id !== photo.id), photo]);
}

export async function uploadPhoto(uid: string, photo: PendingPhoto): Promise<void> {
  const file = new File(photo.uri);
  if (!file.exists || !file.size || file.size > MAX_BYTES) throw new Error('photoMissing');
  await uploadBytes(
    ref(getMobileStorage(), `users/${uid}/photos/${photo.id}`),
    await file.bytes(),
    {
      contentType: 'image/jpeg',
      customMetadata: { capturedAt: photo.date },
    },
  );
}

export async function flushPhotoQueue(uid: string): Promise<PendingPhoto[]> {
  const queue = await readQueue(uid);
  const uploaded: PendingPhoto[] = [];
  for (const photo of queue) {
    try {
      await uploadPhoto(uid, photo);
      uploaded.push(photo);
    } catch {
      break;
    }
  }
  return uploaded;
}

export async function acknowledgePhotos(uid: string, ids: string[]): Promise<void> {
  await writeQueue(
    uid,
    (await readQueue(uid)).filter((item) => !ids.includes(item.id)),
  );
}

export async function pendingPhotoCount(uid: string): Promise<number> {
  return (await readQueue(uid)).length;
}

export function photoUrl(uid: string, id: string): Promise<string> {
  return getDownloadURL(ref(getMobileStorage(), `users/${uid}/photos/${id}`));
}

export async function deletePhoto(uid: string, id: string): Promise<void> {
  await deleteObject(ref(getMobileStorage(), `users/${uid}/photos/${id}`));
  const local = new File(Paths.document, 'kyro-photos', uid, `${id}.jpg`);
  if (local.exists) local.delete();
  await writeQueue(
    uid,
    (await readQueue(uid)).filter((item) => item.id !== id),
  );
}

export async function shareablePhoto(uid: string, id: string, remoteUrl: string): Promise<File> {
  const local = new File(Paths.document, 'kyro-photos', uid, `${id}.jpg`);
  if (local.exists) return local;
  const shared = new File(Paths.cache, `kyro-share-${id}.jpg`);
  return File.downloadFileAsync(remoteUrl, shared, { idempotent: true });
}
