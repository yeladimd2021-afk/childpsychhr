import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, isDemoMode } from "./config";
import { demoCreate } from "@/lib/demo/demoStore";
import type { UserRole } from "@/lib/schemas/user";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Creates a Firebase Auth user + Firestore profile without disturbing the current admin session. */
export async function createUserAccount(params: {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
}) {
  if (isDemoMode) {
    return demoCreate("users", {
      email: params.email,
      displayName: params.displayName,
      role: params.role,
      createdAt: Date.now(),
      active: true,
    });
  }

  const secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      params.email,
      params.password
    );
    await setDoc(doc(db!, "users", credential.user.uid), {
      email: params.email,
      displayName: params.displayName,
      role: params.role,
      createdAt: serverTimestamp(),
      active: true,
    });
    await signOut(secondaryAuth);
    return credential.user.uid;
  } finally {
    await deleteApp(secondaryApp);
  }
}
