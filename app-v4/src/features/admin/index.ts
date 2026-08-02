import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { z } from 'zod';
import { getFirebaseServices } from '../../services/firebase';

const sharedUserSchema = z.object({
  email: z.string().email().or(z.literal('')),
  blocked: z.boolean().default(false),
  isAdmin: z.boolean().default(false),
});
export interface SharedUser extends z.infer<typeof sharedUserSchema> {
  uid: string;
}

export async function listSharedUsers(): Promise<SharedUser[]> {
  const services = getFirebaseServices();
  if (!services) throw new Error('firebase/unavailable');
  const snapshot = await getDocs(collection(services.firestore, 'sharedUsers'));
  return snapshot.docs
    .map((item) => {
      const result = sharedUserSchema.safeParse(item.data());
      return result.success ? { uid: item.id, ...result.data } : null;
    })
    .filter((item): item is SharedUser => item !== null);
}
export async function setUserBlocked(uid: string, blocked: boolean): Promise<void> {
  const services = getFirebaseServices();
  if (!services) throw new Error('firebase/unavailable');
  await updateDoc(doc(services.firestore, 'sharedUsers', uid), { blocked });
}
export async function setUserAdmin(uid: string, isAdmin: boolean): Promise<void> {
  const services = getFirebaseServices();
  if (!services) throw new Error('firebase/unavailable');
  await updateDoc(doc(services.firestore, 'sharedUsers', uid), { isAdmin });
}
