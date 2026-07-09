import type { FundingSource } from "@/lib/schemas/position";

/** Transient parsing-only status, distinct from Position's own status enum — describes what
 * the source row said about the person, before it's split into Position+Employee+Assignment. */
export type ParsedEmployeeStatus = "פעיל" | "עוזב" | "מועמד" | "לא פעיל";

/** Collapses repeated/leading/trailing whitespace — the source file's #1 data-quality issue. */
export function cleanText(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).replace(/\s+/g, " ").trim();
  return text.length > 0 ? text : null;
}

export function normalizeFundingSource(raw: unknown): { value: FundingSource; needsReview: boolean } {
  const text = cleanText(raw);
  if (text === "קרן") return { value: "קרן", needsReview: false };
  if (text === "מדינה") return { value: "מדינה", needsReview: false };
  return { value: "אחר", needsReview: true };
}

/** Same as normalizeFundingSource but treats a blank cell as "unknown" rather than "אחר". */
export function normalizeFundingSourceNullable(
  raw: unknown
): { value: FundingSource | null; needsReview: boolean } {
  const text = cleanText(raw);
  if (text === null) return { value: null, needsReview: false };
  if (text === "קרן") return { value: "קרן", needsReview: false };
  if (text === "מדינה") return { value: "מדינה", needsReview: false };
  return { value: "אחר", needsReview: true };
}

/** Maps the source file's תקן מאוייש column (כן/לא/טרם) onto the employee lifecycle status. */
export function normalizeEmployeeStatus(raw: unknown): ParsedEmployeeStatus {
  const text = cleanText(raw);
  if (text === "כן") return "פעיל";
  if (text === "לא") return "לא פעיל";
  return "מועמד";
}

/** Best-effort split of a single full-name cell into first/last — the source file never
 * separates them, so this is a heuristic (first word vs. remainder) used only by the
 * deprioritized Excel-import path, not by manual entry. */
export function splitFullName(raw: unknown): { firstName: string | null; lastName: string | null } {
  const text = cleanText(raw);
  if (!text) return { firstName: null, lastName: null };
  const [first, ...rest] = text.split(" ");
  return { firstName: first, lastName: rest.length > 0 ? rest.join(" ") : null };
}

/** Israeli IDs are stored as bare numbers in the source and lose leading zeros — restore to 9 digits. */
export function normalizeIdNumber(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const digitsOnly = String(raw).replace(/\D/g, "");
  if (digitsOnly.length === 0) return null;
  return digitsOnly.padStart(9, "0");
}

export function normalizeEmploymentPercent(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (Number.isNaN(n)) return null;
  return n > 1 ? n / 100 : n;
}

/** The source file's "החל מ-" column mixes real dates with free text like "תחזור ב-04/05". */
export function normalizeDateCell(raw: unknown): { date: number | null; text: string | null } {
  if (raw instanceof Date) return { date: raw.getTime(), text: null };
  const text = cleanText(raw);
  if (!text) return { date: null, text: null };
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(text)) {
    return { date: parsed.getTime(), text: null };
  }
  return { date: null, text };
}

/** סעיף תקציב mixes numeric budget codes with free text (names, "DELL", "?", "מלגאית"...). */
export function normalizeBudgetItemRaw(raw: unknown): string | null {
  return cleanText(raw);
}

export function looksLikeBudgetCode(raw: string | null): boolean {
  if (!raw) return false;
  return /^\d{4,}(\+\d{4,})?$/.test(raw.replace(/\s/g, ""));
}
