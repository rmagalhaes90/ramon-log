import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

import { readEnvironment } from '@/config/env';

let auth: Auth | undefined;
let firestore: Firestore | undefined;
let storage: FirebaseStorage | undefined;
let functions: Functions | undefined;

function getMobileApp() {
  if (getApps().length > 0) return getApp();
  const environment = readEnvironment({
    EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  });
  return initializeApp({
    apiKey: environment.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: environment.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: environment.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: environment.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    appId: environment.EXPO_PUBLIC_FIREBASE_APP_ID,
  });
}

export function getMobileAuth(): Auth {
  if (auth) return auth;
  const app = getMobileApp();
  try {
    auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    auth = getAuth(app);
  }
  return auth;
}

export function getMobileFirestore(): Firestore {
  firestore ??= getFirestore(getMobileApp());
  return firestore;
}

export function getMobileStorage(): FirebaseStorage {
  storage ??= getStorage(getMobileApp());
  return storage;
}

export function getMobileFunctions(): Functions {
  functions ??= getFunctions(getMobileApp());
  return functions;
}
