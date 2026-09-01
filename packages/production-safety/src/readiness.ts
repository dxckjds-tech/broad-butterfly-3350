export type CheckStatus = 'PASS' | 'WARNING' | 'FAIL';

export interface ReadinessItem {
  key: string;
  label: string;
  status: CheckStatus;
  detail: string;
  critical: boolean;
}

export interface ProductionReadiness {
  items: ReadinessItem[];
  score: number;
  verdict: 'READY FOR PRODUCTION' | 'PILOT ONLY';
}

export function computeReadiness(items: ReadinessItem[]): ProductionReadiness {
  const criticalFail = items.some((i) => i.critical && i.status === 'FAIL');
  const pass = items.filter((i) => i.status === 'PASS').length;
  const score = items.length === 0 ? 0 : Math.round((pass / items.length) * 100);
  return {
    items,
    score,
    verdict: criticalFail || score < 100 ? 'PILOT ONLY' : 'READY FOR PRODUCTION',
  };
}

export function pickStatus(ok: boolean, warn = false): CheckStatus {
  if (!ok) return 'FAIL';
  if (warn) return 'WARNING';
  return 'PASS';
}
