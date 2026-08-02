import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { firebaseConfig } from './firebase-config';

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  storage: FirebaseStorage;
}

let services: FirebaseServices | undefined;

export function getFirebaseServices(): FirebaseServices | null {
  services ??= (() => {
    const app = initializeApp(firebaseConfig);
    return { app, auth: getAuth(app), firestore: getFirestore(app), storage: getStorage(app) };
  })();
  return services;
}
