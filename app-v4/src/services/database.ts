import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { queueItemSchema, type QueueItem } from '../core/validation';

interface KyroDatabase extends DBSchema {
  cache: { key: string; value: unknown };
  queue: { key: string; value: QueueItem; indexes: { 'by-next-attempt': number } };
  photoQueue: {
    key: string;
    value: { id: string; uid: string; date: string; file: Blob; createdAt: number };
    indexes: { 'by-uid': string };
  };
}

let connection: Promise<IDBPDatabase<KyroDatabase>> | undefined;

export function database(): Promise<IDBPDatabase<KyroDatabase>> {
  connection ??= openDB<KyroDatabase>('kyro-v4', 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('cache');
        const queue = db.createObjectStore('queue', { keyPath: 'id' });
        queue.createIndex('by-next-attempt', 'nextAttemptAt');
      }
      if (oldVersion < 2) {
        const photos = db.createObjectStore('photoQueue', { keyPath: 'id' });
        photos.createIndex('by-uid', 'uid');
      }
    },
  });
  return connection;
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  await (await database()).put('cache', structuredClone(value), key);
}

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  return (await database()).get('cache', key) as Promise<T | undefined>;
}

export async function cacheDelete(key: string): Promise<void> {
  await (await database()).delete('cache', key);
}

export async function queuePut(value: QueueItem): Promise<void> {
  await (await database()).put('queue', queueItemSchema.parse(value));
}

export async function queueList(): Promise<QueueItem[]> {
  const values = await (await database()).getAll('queue');
  return values.map((value) => queueItemSchema.parse(value));
}

export async function queueDelete(id: string): Promise<void> {
  await (await database()).delete('queue', id);
}

export async function pendingPhotoPut(value: {
  id: string;
  uid: string;
  date: string;
  file: Blob;
  createdAt: number;
}): Promise<void> {
  await (await database()).put('photoQueue', value);
}
export async function pendingPhotos(uid: string) {
  return (await database()).getAllFromIndex('photoQueue', 'by-uid', uid);
}
export async function pendingPhotoDelete(id: string): Promise<void> {
  await (await database()).delete('photoQueue', id);
}

export async function clearLocalData(): Promise<void> {
  const db = await database();
  const transaction = db.transaction(['cache', 'queue', 'photoQueue'], 'readwrite');
  await Promise.all([
    transaction.objectStore('cache').clear(),
    transaction.objectStore('queue').clear(),
    transaction.objectStore('photoQueue').clear(),
    transaction.done,
  ]);
}
