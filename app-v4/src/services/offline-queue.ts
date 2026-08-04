import { reportBackgroundError } from '../core/errors';
import type { QueueItem } from '../core/validation';
import { queueDelete, queueList, queuePut } from './database';

export type SyncHandler = (item: QueueItem) => Promise<void>;

export function retryDelay(attempts: number): number {
  return Math.min(3_600_000, 1_500 * 2 ** Math.max(0, attempts));
}

export async function enqueue(
  item: Omit<QueueItem, 'attempts' | 'createdAt' | 'nextAttemptAt'>,
): Promise<void> {
  const now = Date.now();
  await queuePut({ ...item, attempts: 0, createdAt: now, nextAttemptAt: now });
}

export async function flushQueue(
  handler: SyncHandler,
  now = Date.now(),
  accepts: (item: QueueItem) => boolean = () => true,
): Promise<number> {
  if (!navigator.onLine) return 0;
  const pending = (await queueList()).filter((item) => item.nextAttemptAt <= now && accepts(item));
  let completed = 0;
  for (const item of pending) {
    try {
      await handler(item);
      await queueDelete(item.id);
      completed += 1;
    } catch (error) {
      const attempts = item.attempts + 1;
      await queuePut({ ...item, attempts, nextAttemptAt: now + retryDelay(attempts) });
      reportBackgroundError(error, 'offline-sync');
    }
  }
  return completed;
}
