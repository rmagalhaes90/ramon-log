import {
  deleteUser,
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  type User,
} from 'firebase/auth';
import { collection, deleteDoc, doc, getDocs, limit, query, writeBatch } from 'firebase/firestore';
import { deleteObject, listAll, ref, type StorageReference } from 'firebase/storage';
import { getFirebaseServices } from '../../services/firebase';

export type DeletionStage = 'reauth' | 'storage' | 'firestore' | 'profile' | 'account';
export interface DeleteAccountOptions {
  password?: string;
  onStage?: (stage: DeletionStage) => void;
}

async function reauthenticate(user: User, password?: string): Promise<void> {
  const passwordProvider = user.providerData.some(({ providerId }) => providerId === 'password');
  if (passwordProvider) {
    if (!user.email || !password) throw new Error('auth/password-required');
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  } else await reauthenticateWithPopup(user, new GoogleAuthProvider());
}

async function deleteStorageTree(root: StorageReference): Promise<void> {
  const result = await listAll(root);
  await Promise.all(result.items.map((item) => deleteObject(item)));
  for (const prefix of result.prefixes) await deleteStorageTree(prefix);
}

async function deleteFirestoreData(uid: string): Promise<void> {
  const services = getFirebaseServices();
  if (!services) throw new Error('firebase/unavailable');
  const data = collection(services.firestore, 'users', uid, 'data');
  for (let page = 0; page < 100; page += 1) {
    const snapshot = await getDocs(query(data, limit(400)));
    if (snapshot.empty) return;
    const batch = writeBatch(services.firestore);
    snapshot.docs.forEach((item) => batch.delete(item.ref));
    await batch.commit();
  }
  throw new Error('account/data-limit');
}

export async function deleteOwnAccount(
  user: User,
  options: DeleteAccountOptions = {},
): Promise<void> {
  const services = getFirebaseServices();
  if (!services) throw new Error('firebase/unavailable');
  options.onStage?.('reauth');
  await reauthenticate(user, options.password);
  options.onStage?.('storage');
  try {
    await deleteStorageTree(ref(services.storage, `users/${user.uid}/photos`));
  } catch (error: unknown) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    if (code !== 'storage/object-not-found') throw error;
  }
  options.onStage?.('firestore');
  await deleteFirestoreData(user.uid);
  options.onStage?.('profile');
  await deleteDoc(doc(services.firestore, 'sharedUsers', user.uid));
  options.onStage?.('account');
  await deleteUser(user);
}
