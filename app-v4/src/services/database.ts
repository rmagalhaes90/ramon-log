import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { queueItemSchema, type QueueItem } from '../core/validation';

interface KyroDatabase extends DBSchema {
  cache: { key: string; value: unknown };
  queue: { key: string; value: QueueItem; indexes: { 'by-next-attempt': number } };
}

let connection: Promise<IDBPDatabase<KyroDatabase>> | undefined;

export function database(): Promise<IDBPDatabase<KyroDatabase>> {
  connection ??= openDB<KyroDatabase>('kyro-v4', 1, {
    upgrade(db) {
      db.createObjectStore('cache');
      const queue = db.createObjectStore('queue', { keyPath: 'id' });
      queue.createIndex('by-next-attempt', 'nextAttemptAt');
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

export async function cacheDelete(key:string):Promise<void>{
  await (await database()).delete('cache',key);
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

export async function clearLocalData(): Promise<void> {
  const db = await database();
  const transaction = db.transaction(['cache', 'queue'], 'readwrite');
  await Promise.all([transaction.objectStore('cache').clear(), transaction.objectStore('queue').clear(), transaction.done]);
}
