"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db, isDemoMode } from "@/lib/firebase/config";
import { demoGet } from "@/lib/demo/demoStore";
import type { UserProfile } from "@/lib/schemas/user";

type MinimalUser = { uid: string };

type AuthContextValue = {
  user: MinimalUser | null;
  profile: UserProfile | null;
  loading: boolean;
  loadError: string | null;
  isDemoMode: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
};

const DEMO_UID = "demo-admin";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Always start from a consistent "loading, signed out" state on both server and client so
  // hydration never has to reconcile server-rendered fallback data against the client's real
  // localStorage contents — demo-mode data is only read after mount, client-side only.
  const [user, setUser] = useState<MinimalUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (isDemoMode) {
      // One-time client-only read of the localStorage-backed demo store — deliberately not
      // done via useState's initializer, since that would run during SSR too and mismatch
      // against the client's real localStorage contents on hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUser({ uid: DEMO_UID });
      const demoProfile = demoGet<UserProfile & { id: string }>("users", DEMO_UID);
      // The stored doc's own id field is "id", not "uid" — without this, profile.uid is
      // undefined and every "is this the signed-in user" check (e.g. hiding your own
      // deactivate button) silently fails open.
      setProfile(demoProfile ? { ...demoProfile, uid: DEMO_UID } : null);
      setLoading(false);
      return;
    }
    const unsubscribeAuth = onAuthStateChanged(
      auth!,
      (nextUser) => {
        setUser(nextUser ? { uid: nextUser.uid } : null);
        if (!nextUser) {
          setProfile(null);
          setLoading(false);
        }
      },
      (error) => {
        setLoadError(error.message);
        setLoading(false);
      }
    );
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (isDemoMode || !user) return;
    const unsubscribeProfile = onSnapshot(
      doc(db!, "users", user.uid),
      (snapshot) => {
        // Firestore's snapshot.data() never includes the doc id, so uid must be attached
        // explicitly — otherwise profile.uid is undefined for every real-mode user too.
        setProfile(snapshot.exists() ? { ...(snapshot.data() as UserProfile), uid: user.uid } : null);
        setLoading(false);
      },
      (error) => {
        setLoadError(error.message);
        setLoading(false);
      }
    );
    return () => unsubscribeProfile();
  }, [user]);

  async function signIn(email: string, password: string) {
    if (isDemoMode) return;
    setLoadError(null);
    await signInWithEmailAndPassword(auth!, email, password);
  }

  async function signOutUser() {
    if (isDemoMode) return;
    await signOut(auth!);
  }

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, loadError, isDemoMode, signIn, signOutUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
