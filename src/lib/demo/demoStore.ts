/**
 * Mock database used only when Firebase isn't configured (see isDemoMode in
 * lib/firebase/config.ts). Persists to localStorage so everything entered manually (or
 * imported, if that's ever used again) survives a page reload without a real backend.
 */

type Doc = Record<string, unknown> & { id: string };
type Collections = Record<string, Doc[]>;

const STORAGE_KEY = "department-d-positions:mock-db:v2";
const LEGACY_STORAGE_KEY = "department-d-positions:mock-db:v1";

const now = Date.now();

/** Starting state is deliberately empty — this app is meant to be filled in by hand. Only the
 * technical demo-admin account exists, since the app needs *someone* signed in locally. Any
 * doc created later that carries seedSample:true would be treated as a placeholder a real
 * import can clear — nothing here uses that anymore, but the mechanism stays available. */
const INITIAL_STATE: Collections = {
  units: [],
  budgetItems: [],
  positions: [],
  employees: [],
  assignments: [],
  futureChanges: [],
  vacancyReviews: [],
  users: [
    { id: "demo-admin", email: "demo@example.local", displayName: "משתמש הדגמה", role: "admin", active: true, createdAt: now },
  ],
  auditLog: [],
};

let idCounter = 0;
/** A per-module incrementing counter would collide across reloads/HMR (it resets while the
 * persisted data doesn't) — random IDs stay unique regardless of when the module reloads. */
function generateId(collectionName: string): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `demo-${collectionName}-${crypto.randomUUID()}`;
  }
  return `demo-${collectionName}-${Date.now()}-${idCounter++}-${Math.random().toString(36).slice(2)}`;
}

/** v1 stored one flat row per (position, employee) pair. v2 splits that into an independent
 * Position slot + a separate Employee + an Assignment linking them, so an employee can move
 * between positions and a position's occupancy history survives who held it. Runs once, only
 * when v2 has never been written yet but v1 data exists — nothing is lost, just reshaped. */
function migrateLegacyPositions(legacy: Collections): Collections {
  const migratedUnits = legacy.units ?? [];
  const migratedBudgetItems = legacy.budgetItems ?? [];
  const newPositions: Doc[] = [];
  const newEmployees: Doc[] = [];
  const newAssignments: Doc[] = [];

  for (const old of legacy.positions ?? []) {
    const hasEmployee = !!old.firstName;
    const wasCurrentlyActive = old.employeeStatus === "פעיל" || old.employeeStatus === "עוזב";

    newPositions.push({
      id: old.id,
      fundingSource: old.fundingSource ?? "אחר",
      unitId: old.unitId ?? null,
      budgetItemId: old.budgetItemId ?? null,
      budgetItemRaw: old.budgetItemRaw ?? null,
      employmentPercent: old.employmentPercent ?? null,
      role: old.role ?? null,
      status: hasEmployee ? (wasCurrentlyActive ? "מאויש" : "פנוי") : "פנוי",
      source: old.source ?? "ידני",
      notes: old.notes ?? "",
      createdAt: old.createdAt ?? now,
      updatedAt: old.updatedAt ?? now,
    });

    if (hasEmployee) {
      const employeeId = generateId("employees");
      newEmployees.push({
        id: employeeId,
        firstName: old.firstName,
        lastName: old.lastName ?? "",
        idNumber: old.idNumber ?? null,
        source: old.source ?? "ידני",
        notes: "",
        createdAt: old.createdAt ?? now,
        updatedAt: old.updatedAt ?? now,
      });
      newAssignments.push({
        id: generateId("assignments"),
        employeeId,
        positionId: old.id,
        startDate: old.startDate ?? null,
        startDateText: old.startDateText ?? null,
        endDate: wasCurrentlyActive ? null : ((old.updatedAt as number) ?? now),
        employmentPercent: old.employmentPercent ?? null,
        notes: old.notes ?? "",
        createdAt: old.createdAt ?? now,
        updatedAt: old.updatedAt ?? now,
      });
    }
  }

  return {
    units: migratedUnits,
    budgetItems: migratedBudgetItems,
    positions: newPositions,
    employees: newEmployees,
    assignments: newAssignments,
    futureChanges: legacy.futureChanges ?? [],
    vacancyReviews: legacy.vacancyReviews ?? [],
    users: legacy.users ?? structuredClone(INITIAL_STATE.users),
    auditLog: legacy.auditLog ?? [],
  };
}

function loadFromStorage(): Collections | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Collections;

    const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const migrated = migrateLegacyPositions(JSON.parse(legacyRaw) as Collections);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return null;
  } catch {
    return null;
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(collections));
  } catch {
    // localStorage full/unavailable (private browsing etc.) — data stays in-memory for the session
  }
}

const collections: Collections = loadFromStorage() ?? structuredClone(INITIAL_STATE);

function ensureCollection(name: string): Doc[] {
  if (!collections[name]) collections[name] = [];
  return collections[name];
}

export function demoList<T extends Doc>(collectionName: string): T[] {
  return ensureCollection(collectionName).map((d) => ({ ...d })) as T[];
}

export function demoGet<T extends Doc>(collectionName: string, id: string): T | undefined {
  const found = ensureCollection(collectionName).find((d) => d.id === id);
  return found ? ({ ...found } as T) : undefined;
}

export function demoCreate(collectionName: string, data: Record<string, unknown>): string {
  const id = generateId(collectionName);
  ensureCollection(collectionName).push({ id, ...data });
  persist();
  return id;
}

export function demoUpdate(collectionName: string, id: string, patch: Record<string, unknown>): void {
  const list = ensureCollection(collectionName);
  const index = list.findIndex((d) => d.id === id);
  if (index === -1) return;
  list[index] = { ...list[index], ...patch };
  persist();
}

export function demoSet(collectionName: string, id: string, data: Record<string, unknown>): void {
  const list = ensureCollection(collectionName);
  const index = list.findIndex((d) => d.id === id);
  const doc = { id, ...data };
  if (index === -1) list.push(doc);
  else list[index] = doc;
  persist();
}

/** Wipes every collection back to the empty starting state — used by "נקה נתונים וייבא מחדש". */
export function demoClearAllData(): void {
  for (const key of Object.keys(collections)) delete collections[key];
  Object.assign(collections, structuredClone(INITIAL_STATE));
  persist();
}

/** Removes any fabricated seedSample:true placeholders before a real import commits — a no-op
 * today since nothing seeds sample data anymore, kept in case that changes again. */
export function demoClearSeedSamples(): void {
  for (const list of Object.values(collections)) {
    const kept = list.filter((d) => d.seedSample !== true);
    if (kept.length === list.length) continue;
    list.length = 0;
    list.push(...kept);
  }
  persist();
}

/** Rough "has anything been entered yet" signal, used by the dashboard's data-source indicator. */
export function demoIsEmpty(): boolean {
  return (
    ensureCollection("positions").length === 0 &&
    ensureCollection("units").length === 0 &&
    ensureCollection("futureChanges").length === 0
  );
}
