#!/usr/bin/env node
/**
 * One-time migration: makes BudgetItem the central entity that employees are assigned to
 * directly, instead of going through Position.
 *
 * Additive/superseding only — never deletes any document, never modifies an existing
 * Position, never overwrites data other than what's explicitly described below.
 *
 * Phase A — for every existing BudgetItem, sets `fundingSource` (new field) by looking at every
 *   position's budgetComponents that reference its code:
 *     - all matching components agree on one fundingSource  -> use it
 *     - no matching components at all                        -> default "אחר", flagged in report
 *     - matching components disagree                         -> most frequent value used, flagged
 *   Also creates a new BudgetItem (allocatedQuota: 0) for every budgetNumber used in a position's
 *   budgetComponents that doesn't match any existing BudgetItem.code.
 *
 * Phase B — for every position with budgetComponents and an active assignment (endDate: null):
 *     - exactly one component with a non-blank budgetNumber -> the SAME assignment doc is
 *       updated in place with `budgetItemId` (resolved from Phase A) and `role` (= position.role).
 *     - more than one such component -> the original assignment is marked superseded
 *       (`endDate` set to the migration timestamp, plus an internal `_migratedSuperseded: true`
 *       marker used only by this script — invisible to the app) and N new Assignment documents
 *       are created, one per component, each with its own `budgetItemId`/`employmentPercent`.
 *   Components with a blank budgetNumber are skipped and listed in the report — nothing is
 *   guessed for them.
 *
 * Idempotent: an assignment that already has a `budgetItemId` key (set by either this script or
 * the new UI) is left untouched; the same for a BudgetItem that already has `fundingSource`.
 *
 * Usage:
 *   node scripts/migrate-to-budget-item-centric.mjs             — dry run (read-only, prints a report)
 *   node scripts/migrate-to-budget-item-centric.mjs --commit     — actually writes the updates
 *
 * Requires a Firebase service account key, same as scripts/bootstrap-admin.mjs:
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

const [positionsSnap, budgetItemsSnap, assignmentsSnap, unitsSnap, employeesSnap] = await Promise.all([
  db.collection("positions").get(),
  db.collection("budgetItems").get(),
  db.collection("assignments").get(),
  db.collection("units").get(),
  db.collection("employees").get(),
]);

const now = Date.now();
const unitNameById = new Map(unitsSnap.docs.map((d) => [d.id, d.data().name ?? ""]));
const employeeNameById = new Map(
  employeesSnap.docs.map((d) => [d.id, `${d.data().firstName ?? ""} ${d.data().lastName ?? ""}`.trim()])
);

// ---------- Phase A: fundingSource per BudgetItem + create missing BudgetItems ----------

// code (trimmed) -> [{ fundingSource, percent }] across every position's budgetComponents
const componentsByCode = new Map();
for (const doc of positionsSnap.docs) {
  const position = doc.data();
  for (const c of position.budgetComponents ?? []) {
    const code = (c.budgetNumber ?? "").trim();
    if (!code) continue;
    const list = componentsByCode.get(code) ?? [];
    list.push({ fundingSource: c.fundingSource, unitId: position.unitId ?? null });
    componentsByCode.set(code, list);
  }
}

function pickFundingSource(components) {
  const counts = new Map();
  for (const c of components) counts.set(c.fundingSource, (counts.get(c.fundingSource) ?? 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return { chosen: sorted[0]?.[0] ?? "אחר", distinct: counts.size };
}

const budgetItemUpdates = []; // { id, fundingSource }
let fundingAuto = 0;
let fundingDefaulted = [];
let fundingAmbiguous = [];

for (const doc of budgetItemsSnap.docs) {
  const budgetItem = doc.data();
  if (Object.prototype.hasOwnProperty.call(budgetItem, "fundingSource")) continue; // already migrated
  const code = (budgetItem.code ?? "").trim();
  const components = componentsByCode.get(code) ?? [];
  if (components.length === 0) {
    budgetItemUpdates.push({ id: doc.id, fundingSource: "אחר" });
    fundingDefaulted.push({ id: doc.id, code, label: budgetItem.label });
    continue;
  }
  const { chosen, distinct } = pickFundingSource(components);
  budgetItemUpdates.push({ id: doc.id, fundingSource: chosen });
  if (distinct > 1) fundingAmbiguous.push({ id: doc.id, code, label: budgetItem.label, chosen });
  else fundingAuto += 1;
}

// New BudgetItems for codes referenced by positions but with no matching existing BudgetItem.
const existingCodes = new Set(budgetItemsSnap.docs.map((d) => (d.data().code ?? "").trim()));
const newBudgetItems = []; // { code, label, unitId, fundingSource, allocatedQuota: 0 }
const newCodeAmbiguousUnit = [];
for (const [code, components] of componentsByCode.entries()) {
  if (existingCodes.has(code)) continue;
  if (newBudgetItems.some((b) => b.code === code)) continue; // already queued
  const unitIds = new Set(components.map((c) => c.unitId).filter(Boolean));
  const unitId = components.find((c) => c.unitId)?.unitId ?? null;
  if (unitIds.size > 1) newCodeAmbiguousUnit.push({ code, units: [...unitIds].map((id) => unitNameById.get(id) ?? id) });
  const { chosen, distinct } = pickFundingSource(components);
  if (distinct > 1) fundingAmbiguous.push({ id: `(new) ${code}`, code, label: "(סעיף חדש)", chosen });
  newBudgetItems.push({ code, label: "ללא תיאור — נוצר במיגרציה", unitId, fundingSource: chosen, allocatedQuota: 0 });
}

// ---------- Phase B: assignments ----------

const assignmentByPositionId = new Map();
for (const doc of assignmentsSnap.docs) {
  const a = doc.data();
  if (a.positionId && a.endDate === null) assignmentByPositionId.set(a.positionId, { id: doc.id, ...a });
}

// code -> budgetItemId, combining existing + about-to-be-created items
const budgetItemIdByCode = new Map(budgetItemsSnap.docs.map((d) => [(d.data().code ?? "").trim(), d.id]));
// Placeholder ids for new items resolved after creation (dry run just reports by code).

const singleUpdates = []; // { assignmentId, budgetItemId (or code if new), role, employeeName, positionRole }
const splitPositions = []; // { positionId, employeeName, positionRole, components: [{code, percent, fundingSource}] }
const skippedBlank = []; // { positionId, positionRole }
let alreadyMigratedAssignments = 0;

for (const doc of positionsSnap.docs) {
  const position = doc.data();
  const components = (position.budgetComponents ?? []).filter((c) => (c.budgetNumber ?? "").trim());
  const blankCount = (position.budgetComponents ?? []).length - components.length;
  if (blankCount > 0) skippedBlank.push({ positionId: doc.id, positionRole: position.role ?? "תקן", count: blankCount });
  if (components.length === 0) continue;

  const assignment = assignmentByPositionId.get(doc.id);
  if (!assignment) continue; // vacant — nothing to migrate for Assignment, BudgetItem already handled above

  if (Object.prototype.hasOwnProperty.call(assignment, "budgetItemId")) {
    alreadyMigratedAssignments += 1;
    continue;
  }

  const employeeName = employeeNameById.get(assignment.employeeId) ?? "(לא ידוע)";

  if (components.length === 1) {
    const code = components[0].budgetNumber.trim();
    singleUpdates.push({
      assignmentId: assignment.id,
      code,
      role: position.role ?? null,
      employeeName,
      positionRole: position.role ?? "תקן",
      percent: components[0].percent,
    });
  } else {
    splitPositions.push({
      positionId: doc.id,
      assignmentId: assignment.id,
      employeeName,
      positionRole: position.role ?? "תקן",
      role: position.role ?? null,
      components: components.map((c) => ({ code: c.budgetNumber.trim(), percent: c.percent, fundingSource: c.fundingSource })),
    });
  }
}

// ---------- Report ----------

console.log(`מצב: ${commit ? "הרצה אמיתית (--commit)" : "Dry Run — קריאה בלבד, שום דבר לא נכתב"}`);
console.log("");
console.log(`סעיפי תקציב קיימים: ${budgetItemsSnap.size}`);
console.log(`  יקבלו מקור תקציב אוטומטית (חד-משמעי): ${fundingAuto}`);
console.log(`  ללא רכיב תואם — ברירת מחדל "אחר": ${fundingDefaulted.length}`);
if (fundingDefaulted.length > 0) {
  for (const b of fundingDefaulted) console.log(`    ${b.code} · ${b.label}`);
}
console.log(`  סעיפים חדשים שייווצרו (קוד לא תאם שום סעיף קיים): ${newBudgetItems.length}`);
for (const b of newBudgetItems) console.log(`    ${b.code} — מקור: ${b.fundingSource}${b.unitId ? ` · יחידה: ${unitNameById.get(b.unitId) ?? b.unitId}` : ""}`);
if (newCodeAmbiguousUnit.length > 0) {
  console.log(`  ⚠ קודים חדשים שמופיעים תחת יותר מיחידה אחת (נבחרה הראשונה שנמצאה, בדקי ידנית):`);
  for (const c of newCodeAmbiguousUnit) console.log(`    ${c.code}: ${c.units.join(", ")}`);
}
if (fundingAmbiguous.length > 0) {
  console.log(`  ⚠ סתירת מקור תקציב (רכיבים שונים לאותו קוד) — נבחר הנפוץ ביותר, בדקי ידנית: ${fundingAmbiguous.length}`);
  for (const b of fundingAmbiguous) console.log(`    ${b.code} · ${b.label} → נבחר: ${b.chosen}`);
}
console.log("");
console.log(`תקנים בסה"כ: ${positionsSnap.size}`);
console.log(`שיבוצים קיימים: ${assignmentsSnap.size}`);
console.log(`  כבר עברו מיגרציה (מדולגים): ${alreadyMigratedAssignments}`);
console.log(`  יעודכנו במקום (רכיב תקציב יחיד): ${singleUpdates.length}`);
console.log(`  ידרשו פיצול (כמה רכיבי תקציב על אותו תקן/שיבוץ): ${splitPositions.length}`);
if (splitPositions.length > 0) {
  for (const s of splitPositions) {
    console.log(`    ${s.employeeName} · ${s.positionRole} — ${s.components.length} רכיבים (${s.components.map((c) => `${c.code}: ${Math.round(c.percent * 100)}%`).join(", ")})`);
  }
}
if (skippedBlank.length > 0) {
  console.log(`  ⚠ רכיבי תקציב עם מספר סעיף ריק — לא ניתן למיגרציה (${skippedBlank.length} תקנים):`);
  for (const s of skippedBlank) console.log(`    ${s.positionRole} (${s.positionId}) — ${s.count} רכיבים ריקים`);
}
console.log("");

if (!commit) {
  console.log("זו הרצת Dry Run בלבד. להרצה אמיתית: node scripts/migrate-to-budget-item-centric.mjs --commit");
  process.exit(0);
}

// ---------- Commit ----------

// 1. BudgetItem fundingSource backfills
if (budgetItemUpdates.length > 0) {
  const CHUNK = 450;
  for (let i = 0; i < budgetItemUpdates.length; i += CHUNK) {
    const batch = db.batch();
    for (const { id, fundingSource } of budgetItemUpdates.slice(i, i + CHUNK)) {
      batch.update(db.collection("budgetItems").doc(id), { fundingSource, updatedAt: now });
    }
    await batch.commit();
  }
  console.log(`עודכן מקור תקציב עבור ${budgetItemUpdates.length} סעיפים קיימים.`);
}

// 2. New BudgetItems
const newCodeToId = new Map();
for (const b of newBudgetItems) {
  const id = await db.collection("budgetItems").add({
    unitId: b.unitId,
    code: b.code,
    label: b.label,
    fundingSource: b.fundingSource,
    allocatedQuota: b.allocatedQuota,
    notes: "",
    createdAt: now,
    updatedAt: now,
  });
  newCodeToId.set(b.code, id.id);
}
if (newBudgetItems.length > 0) console.log(`נוצרו ${newBudgetItems.length} סעיפי תקציב חדשים.`);

function resolveBudgetItemId(code) {
  return budgetItemIdByCode.get(code) ?? newCodeToId.get(code) ?? null;
}

// 3. Single-component assignments: update in place
for (const u of singleUpdates) {
  const budgetItemId = resolveBudgetItemId(u.code);
  await db.collection("assignments").doc(u.assignmentId).update({
    budgetItemId,
    role: u.role,
    updatedAt: now,
  });
}
if (singleUpdates.length > 0) console.log(`עודכנו ${singleUpdates.length} שיבוצים קיימים (רכיב יחיד).`);

// 4. Multi-component: supersede original, create N new assignments
let splitCreated = 0;
for (const s of splitPositions) {
  await db.collection("assignments").doc(s.assignmentId).update({
    endDate: now,
    _migratedSuperseded: true,
    updatedAt: now,
  });
  const original = assignmentsSnap.docs.find((d) => d.id === s.assignmentId)?.data();
  for (const c of s.components) {
    const budgetItemId = resolveBudgetItemId(c.code);
    await db.collection("assignments").add({
      employeeId: original.employeeId,
      budgetItemId,
      role: s.role,
      positionId: null,
      startDate: original.startDate ?? null,
      startDateText: original.startDateText ?? null,
      endDate: null,
      employmentPercent: c.percent,
      notes: original.notes ?? "",
      createdAt: now,
      updatedAt: now,
    });
    splitCreated += 1;
  }
}
if (splitPositions.length > 0) {
  console.log(`פוצלו ${splitPositions.length} שיבוצים ל-${splitCreated} שיבוצים חדשים (המקוריים סומנו כהסתיימו, לא נמחקו).`);
}

console.log("הושלם.");
