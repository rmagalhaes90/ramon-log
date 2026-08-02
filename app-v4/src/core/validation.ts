import { z } from 'zod';

export const queueItemSchema = z.object({
  id: z.string().min(1).max(128),
  feature: z.string().min(1).max(64),
  operation: z.enum(['set', 'delete', 'upload']),
  path: z.string().min(1).max(512),
  payload: z.unknown(),
  attempts: z.number().int().min(0).max(100),
  createdAt: z.number().int().positive(),
  nextAttemptAt: z.number().int().nonnegative(),
});

export type QueueItem = z.infer<typeof queueItemSchema>;
