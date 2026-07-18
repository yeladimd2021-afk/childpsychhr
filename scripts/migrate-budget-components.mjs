#!/usr/bin/env node
/**
 * One-time migration: adds `budgetComponents` to every Position that doesn't have it yet,
 * mirroring its existing single fundingSource/budgetItemId/budgetItemRaw/employmentPercent as
 * exactly one component. Additive only — never touches any other field, never deletes anything.
 *
 * Idempotent: a position that already has a `budgetComponents` key (even an empty array) is
 * left untouched, so running this again is always safe.
 *
 * Usage:
 *   node scripts/migrate-budget-components.mjs             — dry run (read-only, prints a report)
 *   node scripts/migrate-budget-components.mjs --commit     — actually writes the updates
 *
 * Requires a Firebase service account key, same as scripts/bootstrap-admin.mjs:
 *   Project settings → Service accounts → Generate new private key → save as
 *   serviceAccountKey.json in the project root (or set SERVICE_ACCOUNT_PATH).
 */
import { existsSync, readFileSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const commit = process.argv.includes("--commit");

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
const db = getFirestore();

const [positionsSnap, budgetItemsSnap, employeesSnap, unitsSnap, assignmentsSnap] = await Promise.all([
  db.collection("positions").get(),
  db.collection("budgetItems").get(),
  db.collection("employees").get(),
  db.collection("units").get(),
  db.collection("assignments").get(),
]);

const budgetItemCodeById = new Map(budgetItemsSnap.docs.map((d) => [d.id, d.data().code ?? ""]));

let alreadyMigrated = 0;
let toMigrate = 0;
const updates = []; // { id, budgetComponents }

for (const doc of positionsSnap.docs) {
  const position = doc.data();
  if (Object.prototype.hasOwnProperty.call(position, "budgetComponents")) {
    alreadyMigrated += 1;
    continue;
  }
  const budgetNumber =
    position.budgetItemRaw || (position.budgetItemId ? (budgetItemCodeById.get(position.budgetItemId) ?? "") : "");
  const percent = position.employmentPercent ?? 0;
  const budgetComponents =
    percent > 0
      ? [
          {
            fundingSource: position.fundingSource ?? "אחר",
            budgetNumber,
            percent,
            notes: "",
          },
        ]
      : [];
  updates.push({ id: doc.id, budgetComponents });
  toMigrate += 1;
}

// Read-only, informational: groups of positions sharing the same (unit, role) — worth a manual
// look to see whether any of them actually represent one job fragmented across budget codes.
// Nothing here is merged or changed automatically.
const groupKey = (p) => `${p.unitId ?? "—"}::${p.role ?? "—"}`;
const groups = new Map();
for (const doc of positionsSnap.docs) {
  const position = doc.data();
  const key = groupKey(position);
  const list = groups.get(key) ?? [];
  list.push({ id: doc.id, role: position.role, unitId: position.unitId });
  groups.set(key, list);
}
const unitNameById = new Map(unitsSnap.docs.map((d) => [d.id, d.data().name ?? ""]));
const candidateGroups = [...groups.entries()].filter(([, list]) => list.length > 1);

console.log(`מצב: ${commit ? "הרצה אמיתית (--commit)" : "Dry Run — קריאה בלבד, שום דבר לא נכתב"}`);
console.log("");
console.log(`תקנים בסה"כ: ${positionsSnap.size}`);
console.log(`  כבר עברו מיגרציה (מדולגים): ${alreadyMigrated}`);
console.log(`  יקבלו רכיב תקציב אחד: ${toMigrate}`);
console.log(`עובדים קיימים (ללא שינוי): ${employeesSnap.size}`);
console.log(`יחידות קיימות (ללא שינוי): ${unitsSnap.size}`);
console.log(`שיבוצים קיימים (ללא שינוי): ${assignmentsSnap.size}`);
console.log(`סעיפי תקציב קיימים (ללא שינוי): ${budgetItemsSnap.size}`);
console.log("");

if (candidateGroups.length > 0) {
  console.log(`מועמדים לאיחוד ידני (אותה יחידה+תפקיד, יותר מתקן אחד) — ${candidateGroups.length} קבוצות:`);
  for (const [, list] of candidateGroups) {
    const unitName = list[0].unitId ? (unitNameById.get(list[0].unitId) ?? "?") : "ללא יחידה";
    console.log(`  ${list[0].role ?? "ללא תפקיד"} · ${unitName} — ${list.length} תקנים (${list.map((p) => p.id).join(", ")})`);
  }
  console.log("  (מידע בלבד — לא מתבצע איחוד אוטומטי. בדקי ידנית אם כדאי לאחד.)");
  console.log("");
}

if (!commit) {
  console.log("זו הרצת Dry Run בלבד. להרצה אמיתית: node scripts/migrate-budget-components.mjs --commit");
  process.exit(0);
}

if (toMigrate === 0) {
  console.log("אין תקנים שדורשים מיגרציה.");
  process.exit(0);
}

// Firestore batched writes are capped at 500 ops each.
const CHUNK = 450;
for (let i = 0; i < updates.length; i += CHUNK) {
  const batch = db.batch();
  for (const { id, budgetComponents } of updates.slice(i, i + CHUNK)) {
    batch.update(db.collection("positions").doc(id), { budgetComponents });
  }
  await batch.commit();
  console.log(`נכתבו ${Math.min(i + CHUNK, updates.length)} / ${updates.length}...`);
}

console.log(`הושלם — ${toMigrate} תקנים עודכנו עם רכיב תקציב אחד.`);
