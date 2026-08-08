import { z } from 'zod';

const optional = z.string().trim().optional().default('');
const schema = z.object({
  VITE_FIREBASE_API_KEY: optional,
  VITE_FIREBASE_AUTH_DOMAIN: optional,
  VITE_FIREBASE_PROJECT_ID: optional,
  VITE_FIREBASE_STORAGE_BUCKET: optional,
  VITE_FIREBASE_MESSAGING_SENDER_ID: optional,
  VITE_FIREBASE_APP_ID: optional,
  VITE_FIREBASE_VAPID_KEY: optional,
  VITE_RECAPTCHA_ENTERPRISE_SITE_KEY: optional,
  VITE_USE_FIREBASE_EMULATORS: z.enum(['true', 'false']).optional().default('false'),
});

export const env = schema.parse(import.meta.env);
