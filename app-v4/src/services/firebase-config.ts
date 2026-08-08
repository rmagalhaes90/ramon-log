import { env } from '../env';

// Firebase web identifiers are public. Environment variables override the production
// baseline so preview/test projects can be used without source edits.
const emulator = env.VITE_USE_FIREBASE_EMULATORS === 'true';
export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyDt-u1QOFEnCsoJmf1mXd31AOfSyQBtMZY',
  authDomain: emulator
    ? 'demo-kyro-v4.firebaseapp.com'
    : env.VITE_FIREBASE_AUTH_DOMAIN || 'traincontrollog.firebaseapp.com',
  projectId: emulator ? 'demo-kyro-v4' : env.VITE_FIREBASE_PROJECT_ID || 'traincontrollog',
  storageBucket: emulator
    ? 'demo-kyro-v4.appspot.com'
    : env.VITE_FIREBASE_STORAGE_BUCKET || 'traincontrollog.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1042724517113',
  appId: env.VITE_FIREBASE_APP_ID || '1:1042724517113:web:ae380512980eab207d1e28',
} as const;
