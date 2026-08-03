import { z } from 'zod';

const envSchema = z.object({
  EXPO_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  EXPO_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
});

export type MobileEnvironment = z.infer<typeof envSchema>;

export function readEnvironment(source: Record<string, string | undefined>): MobileEnvironment {
  return envSchema.parse(source);
}
