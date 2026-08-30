import type { RuntimeSafety } from './env.js';

export const FORBIDDEN_PRODUCTION_ACTIONS = [
  'mix_mock_with_live',
  'auto_modify_mic_product',
  'auto_publish',
  'auto_send_inquiry',
  'auto_submit_rfq',
  'auto_change_account_security',
  'auto_bypass_captcha',
  'replay_session_token',
] as const;

export type ForbiddenAction = (typeof FORBIDDEN_PRODUCTION_ACTIONS)[number];

export function assertMicWriteAllowed(safety: RuntimeSafety, action: string): void {
  if (safety.dryRun) {
    throw Object.assign(new Error('MIC_WRITE_BLOCKED'), { code: 'MIC_WRITE_BLOCKED', action, dryRun: true });
  }
  if (safety.appEnv === 'production') {
    throw Object.assign(new Error('MIC_WRITE_BLOCKED'), { code: 'MIC_WRITE_BLOCKED', action, production: true });
  }
}

export function assertNoMockMixin(liveCount: number, demoCount: number): void {
  if (liveCount > 0 && demoCount > 0) {
    throw Object.assign(new Error('MIC_MOCK_MIXIN'), { code: 'MIC_MOCK_MIXIN' });
  }
}

export function applyPilotLimits<T>(items: T[], limit: number, isPilot: boolean): T[] {
  if (!isPilot) return items;
  return items.slice(0, limit);
}
