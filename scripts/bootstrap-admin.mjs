#!/usr/bin/env node
/**
 * Creates the first administrator account in a fresh Firebase project — solves the
 * chicken-and-egg problem where firestore.rules require a `users/{uid}` doc to read anything,
 * so no one can create that very first doc through the app itself. Uses the Admin SDK, which
 * bypasses security rules entirely, so this only ever needs to run once per project.
 *
 * Usage:
 *   node scripts/bootstrap-admin.mjs <email> <password> <displayName>
 *
 * Requires a Firebase service account key. In the Firebase console:
 *   Project settings → Service accounts → Generate new private key
 * Save the downloaded file as serviceAccountKey.json in the project root (already gitignored),
 * or point SERVICE_ACCOUNT_PATH at wherever you saved it.
 */
import { existsSync, readFileSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const [, , email, password, displayName] = process.argv;

if (!email || !password || !displayName) {
  console.error("Usage: node scripts/bootstrap-admin.mjs <email> <password> <displayName>");
  process.exit(1);
}
if (password.length < 6) {
  console.error("Password must be at least 6 characters (Firebase Auth's minimum).");
  process.exit(1);
}

const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH ?? "./serviceAccountKey.json";
if (!existsSync(serviceAccountPath)) {
  console.error(
    `Service account key not found at "${serviceAccountPath}".\n` +
      "Download one from the Firebase console: Project settings → Service accounts → " +
      "Generate new private key, save it as serviceAccountKey.json in the project root " +
      "(or set SERVICE_ACCOUNT_PATH to point elsewhere)."
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth();
const db = getFirestore();

let userRecord;
try {
  userRecord = await auth.getUserByEmail(email);
  console.log(`User ${email} already exists (uid=${userRecord.uid}) — granting admin role.`);
} catch (err) {
  if (err.code === "auth/user-not-found") {
    userRecord = await auth.createUser({ email, password, displayName });
    console.log(`Created Auth user ${email} (uid=${userRecord.uid}).`);
  } else {
    throw err;
  }
}

await db.doc(`users/${userRecord.uid}`).set(
  {
    email,
    displayName,
    role: "admin",
    active: true,
    createdAt: Date.now(),
  },
  { merge: true }
);

console.log(`Done — ${email} is an active admin. Sign in at /login with this email and password.`);
