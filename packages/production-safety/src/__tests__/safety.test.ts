import { describe, expect, it } from 'vitest';
import { loadRuntimeSafety, assertLiveModeAllowed } from '../env.js';
import { applyPilotLimits, assertMicWriteAllowed, assertNoMockMixin } from '../guard.js';
import { validateParserBatch, sampleMatchRate, PRODUCT_COMPARE_FIELDS } from '../parser-validation.js';
import { scanInventedFacts } from '../fact-guard.js';
import { computeReadiness } from '../readiness.js';
import { redactAuditPayload } from '../redact.js';
import { LIVE_SYNC_FAILED_MESSAGE } from '../codes.js';

describe('runtime env', () => {
  it('production defaults to live and dry-run', () => {
    const s = loadRuntimeSafety({ APP_ENV: 'production', DRY_RUN: 'true' });
    expect(s.appEnv).toBe('production');
    expect(s.micDataMode).toBe('live');
    expect(s.dryRun).toBe(true);
    expect(s.pilotProductLimit).toBe(20);
  });

  it('forbids fixture fallback in production live', () => {
    const s = loadRuntimeSafety({ APP_ENV: 'production', MIC_DATA_MODE: 'live' });
    expect(() => assertLiveModeAllowed(s, 'fixture')).toThrow('MIC_FIXTURE_FORBIDDEN');
  });
});

describe('guards', () => {
  it('blocks MIC writes in dry-run', () => {
    const s = loadRuntimeSafety({ DRY_RUN: 'true' });
    expect(() => assertMicWriteAllowed(s, 'publish')).toThrow('MIC_WRITE_BLOCKED');
  });

  it('applies pilot limits', () => {
    expect(applyPilotLimits([1, 2, 3, 4], 2, true)).toEqual([1, 2]);
    expect(applyPilotLimits([1, 2, 3, 4], 2, false)).toHaveLength(4);
  });

  it('rejects mock mixin', () => {
    expect(() => assertNoMockMixin(2, 1)).toThrow('MIC_MOCK_MIXIN');
  });
});

describe('parser validation', () => {
  it('classifies parser batch below 80% as abort', () => {
    const v = validateParserBatch({ total: 20, identified: 15, failed: 5, lowConfidence: 0, fieldCompleteness: 0.5 });
    expect(v.abortBatch).toBe(true);
    expect(v.message).toMatch(/解析器/);
  });

  it('computes match rate', () => {
    const r = sampleMatchRate(
      [{ expected: { name: 'A', status: 'on' }, actual: { name: 'A', status: 'off' } }],
      ['name', 'status'],
    );
    expect(r.matchRate).toBe(0.5);
    expect(PRODUCT_COMPARE_FIELDS.length).toBeGreaterThan(0);
  });
});

describe('fact guard', () => {
  it('flags invented certification', () => {
    const r = scanInventedFacts('ISO 9001 certified CE FDA', { certification: ['ce'] });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('FACT_GUARD_FAIL');
  });
});

describe('readiness + redact', () => {
  it('PILOT ONLY unless all critical pass', () => {
    const r = computeReadiness([
      { key: 'db', label: 'Database', status: 'PASS', detail: '', critical: true },
      { key: 'mic', label: 'MIC', status: 'FAIL', detail: '', critical: true },
    ]);
    expect(r.verdict).toBe('PILOT ONLY');
  });

  it('redacts secrets', () => {
    const out = redactAuditPayload({ password: 'x', cookie: 'y', products: 3 }) as Record<string, unknown>;
    expect(out.password).toBe('[redacted]');
    expect(out.products).toBe(3);
  });

  it('exposes live fail copy', () => {
    expect(LIVE_SYNC_FAILED_MESSAGE).toBe('真实数据同步失败');
  });
});
