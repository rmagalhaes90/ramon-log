import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';
import { env } from '../env';
import { firebaseConfig } from './firebase-config';

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  storage: FirebaseStorage;
}

let services: FirebaseServices | undefined;

export function useFirebaseEmulators(): boolean {
  return env.VITE_USE_FIREBASE_EMULATORS === 'true';
}

function connectEmulators(current: FirebaseServices): void {
  connectAuthEmulator(current.auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(current.firestore, '127.0.0.1', 8080);
  connectStorageEmulator(current.storage, '127.0.0.1', 9199);
}

export function getFirebaseServices(): FirebaseServices | null {
  services ??= (() => {
    const app = initializeApp(firebaseConfig);
    const current = {
      app,
      auth: getAuth(app),
      firestore: getFirestore(app),
      storage: getStorage(app),
    };
    if (useFirebaseEmulators()) connectEmulators(current);
    return current;
  })();
  return services;
}
