import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { initializeFirestore, getFirestore, setLogLevel, enableNetwork, type Firestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

try {
  setLogLevel('silent');
} catch {}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Use the specific firestoreDatabaseId provisioned, forcing long-polling to prevent
// iframe/proxy WebChannel streaming connection failures (code=unavailable)
let firestoreDb: Firestore;
try {
  firestoreDb = initializeFirestore(
    app,
    {
      experimentalForceLongPolling: true,
    },
    firebaseConfig.firestoreDatabaseId
  );
} catch {
  firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

// The provisioned database is configured via firestoreDatabaseId in firebaseConfig.
// Avoid instantiating an unprovisioned (default) database client, which causes [code=unavailable] errors.
export const db = firestoreDb;
export const defaultDb: Firestore | null = null;

export { signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, enableNetwork };
export type { User };
