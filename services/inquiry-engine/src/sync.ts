import type { MICModuleResult, MICSyncMode, MICSyncStatus, MICVirtualOfficeData } from '@trade-ai/shared-types';
import { overallSyncStatus } from '@trade-ai/platform-adapters';

export interface SyncCursor {
  productsCursor: string | null;
  inquiriesCursor: string | null;
  sourcingCursor: string | null;
  lastSuccessfulSyncAt: string | null;
  productHashes: Record<string, string>;
}

export function emptyCursor(): SyncCursor {
  return {
    productsCursor: null,
    inquiriesCursor: null,
    sourcingCursor: null,
    lastSuccessfulSyncAt: null,
    productHashes: {},
  };
}

export function applyIncrementalProducts(data: MICVirtualOfficeData, cursor: SyncCursor): {
  changed: MICVirtualOfficeData['products'];
  unchanged: number;
  statusChanges: Array<{ id: string; from: string; to: string }>;
} {
  if (data.syncMeta.mode !== 'INCREMENTAL') {
    return { changed: data.products, unchanged: 0, statusChanges: [] };
  }
  const changed: MICVirtualOfficeData['products'] = [];
  const statusChanges: Array<{ id: string; from: string; to: string }> = [];
  let unchanged = 0;
  for (const p of data.products) {
    const prev = cursor.productHashes[p.micProductId];
    if (prev && prev === p.rawSourceHash) {
      unchanged += 1;
      continue;
    }
    changed.push(p);
  }
  void statusChanges;
  return { changed, unchanged, statusChanges };
}

export function finalizeJobStatus(data: MICVirtualOfficeData): MICSyncStatus {
  return overallSyncStatus(data);
}

export function describeModules(modules: MICModuleResult<unknown>[]): string[] {
  return modules.map((m) => `${m.module}:${m.status}:${m.records.length}`);
}

export { overallSyncStatus };
export type { MICSyncMode };
