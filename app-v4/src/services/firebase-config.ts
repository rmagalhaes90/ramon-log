import { env } from '../env';

// Firebase web identifiers are public. Environment variables override the production
// baseline so preview/test projects can be used without source edits.
export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyDt-u1QOFEnCsoJmf1mXd31AOfSyQBtMZY',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'traincontrollog.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'traincontrollog',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'traincontrollog.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1042724517113',
  appId: env.VITE_FIREBASE_APP_ID || '1:1042724517113:web:ae380512980eab207d1e28',
} as const;
