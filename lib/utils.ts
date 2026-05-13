import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// ─── Permanent Null-Safety Helpers ────────────────────────────────────────────
// Use these everywhere to prevent blank-page crashes from null/undefined data.

/**
 * Safe string coercion.
 * s(job.title).toLowerCase()  →  always safe, never throws
 */
export const s = (val: unknown): string =>
  val == null ? '' : String(val);

/**
 * Safe array coercion.
 * arr(response.data).map(...)  →  always safe, never throws
 */
export const arr = <T>(val: T[] | null | undefined): T[] =>
  Array.isArray(val) ? val : [];

/**
 * Safe number coercion with optional fallback.
 * num(row.amount)       →  0 if null/undefined/NaN
 * num(row.amount, -1)   →  -1 if null/undefined/NaN
 */
export const num = (val: unknown, fallback = 0): number => {
  const n = Number(val);
  return isNaN(n) ? fallback : n;
};
