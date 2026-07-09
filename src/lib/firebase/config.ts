import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function hasCompleteConfig() {
  return Object.values(firebaseConfig).every((v) => !!v && v.trim().length > 0);
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let demoMode = !hasCompleteConfig();

if (!demoMode) {
  try {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch {
    // Malformed config despite all fields being present — fall back to demo mode
    // instead of crashing the whole app on a bad .env.local value.
    demoMode = true;
    app = null;
    auth = null;
    db = null;
  }
}

/** True when Firebase env vars are missing/invalid — app runs on in-memory demo data instead. */
export const isDemoMode = demoMode;
export { app, auth, db };
