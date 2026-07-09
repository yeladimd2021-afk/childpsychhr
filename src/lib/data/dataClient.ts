import { addDoc, collection, doc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { db, isDemoMode } from "@/lib/firebase/config";
import {
  demoClearAllData,
  demoClearSeedSamples,
  demoCreate,
  demoIsEmpty,
  demoList,
  demoSet,
  demoUpdate,
} from "@/lib/demo/demoStore";

/** Thin Firestore/demo-store switch so query hooks don't each need their own isDemoMode branch. */

export async function listDocs<T>(collectionName: string): Promise<(T & { id: string })[]> {
  if (isDemoMode) return demoList(collectionName) as (T & { id: string })[];
  const snapshot = await getDocs(collection(db!, collectionName));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T & { id: string });
}

/** Removes fabricated demo-mode sample rows before a real import commits — a no-op against
 * real Firestore, where those seedSample docs never exist. */
export function clearSeedSamples(): void {
  if (isDemoMode) demoClearSeedSamples();
}

/** "נקה נתונים וייבא מחדש" — wipes the local mock database back to empty. No-op against real
 * Firestore (that action isn't offered once a real project is connected). */
export function clearAllLocalData(): void {
  if (isDemoMode) demoClearAllData();
}

export function isLocalDataEmpty(): boolean {
  return isDemoMode ? demoIsEmpty() : false;
}

export async function createDoc(
  collectionName: string,
  data: Record<string, unknown>
): Promise<string> {
  if (isDemoMode) return demoCreate(collectionName, data);
  const ref = await addDoc(collection(db!, collectionName), data);
  return ref.id;
}

export async function updateDocById(
  collectionName: string,
  id: string,
  data: Record<string, unknown>
): Promise<void> {
  if (isDemoMode) {
    demoUpdate(collectionName, id, data);
    return;
  }
  await updateDoc(doc(db!, collectionName, id), data);
}

export async function setDocById(
  collectionName: string,
  id: string,
  data: Record<string, unknown>
): Promise<void> {
  if (isDemoMode) {
    demoSet(collectionName, id, data);
    return;
  }
  await setDoc(doc(db!, collectionName, id), data);
}
