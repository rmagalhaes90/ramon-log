import { httpsCallable } from 'firebase/functions';
import { z } from 'zod';
import { getFirebaseServices } from '../../services/firebase';

export const entitlementsSchema = z.object({
  plan: z.enum(['free', 'pro', 'coach']),
  status: z.string().max(40),
  features: z.array(z.enum(['history', 'progression', 'reports', 'photos', 'coach'])).max(10),
});
export type Entitlements = z.infer<typeof entitlementsSchema>;

export async function loadEntitlements(): Promise<Entitlements> {
  const services = getFirebaseServices();
  if (!services) throw new Error('firebase/unavailable');
  const result = await httpsCallable(services.functions, 'getEntitlements')();
  return entitlementsSchema.parse(result.data);
}
