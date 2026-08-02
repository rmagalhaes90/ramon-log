import { describe, expect, it } from 'vitest';
import { queueItemSchema } from '../src/core/validation';
import { retryDelay } from '../src/services/offline-queue';
import { unwrapQueuedPayload } from '../src/services/user-data';

describe('offline queue', () => {
  it('validates a bounded operation', () => {
    expect(
      queueItemSchema.parse({
        id: '1',
        feature: 'workouts',
        operation: 'set',
        path: 'users/u/data/workouts',
        payload: {},
        attempts: 0,
        createdAt: 1,
        nextAttemptAt: 0,
      }).id,
    ).toBe('1');
  });
  it('rejects unknown operations', () => {
    expect(() =>
      queueItemSchema.parse({
        id: '1',
        feature: 'x',
        operation: 'execute',
        path: 'x',
        payload: null,
        attempts: 0,
        createdAt: 1,
        nextAttemptAt: 0,
      }),
    ).toThrow();
  });
  it('caps exponential retry at one hour', () => {
    expect(retryDelay(100)).toBe(3_600_000);
  });
  it('keeps queued revisions backward compatible', () => {
    expect(
      unwrapQueuedPayload({ value: { a: 1 }, updatedAt: '2026-08-02T12:00:00.000Z' }, 1),
    ).toEqual({ value: { a: 1 }, updatedAt: '2026-08-02T12:00:00.000Z' });
    expect(unwrapQueuedPayload({ a: 1 }, 1000).updatedAt).toBe('1970-01-01T00:00:01.000Z');
  });
});
