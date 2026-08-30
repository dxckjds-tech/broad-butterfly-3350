import { COMPANY_SIGNALS } from './text';

export function companyEvidenceScore(blob: string): number {
  const lower = blob.toLowerCase();
  const hits = COMPANY_SIGNALS.filter((s) => lower.includes(s)).length;
  const hasNumber = /\b\d{2,}\b/.test(blob);
  const genericOnly = /professional manufacturer|we are a/i.test(blob) && hits < 2;

  if (!blob.trim()) return 0;
  if (genericOnly && hits <= 1) return 1;
  if (hits <= 2) return 2;
  if (hits <= 4 && !hasNumber) return 3;
  if (hits >= 3 && hasNumber) return 4;
  if (hits >= 5 && hasNumber) return 5;
  return Math.min(5, Math.max(2, Math.round(hits / 2)));
}
