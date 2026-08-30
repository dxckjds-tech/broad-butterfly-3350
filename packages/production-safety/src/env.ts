export type AppEnv = 'development' | 'staging' | 'production';
export type MicDataMode = 'fixture' | 'live';

export interface RuntimeSafety {
  appEnv: AppEnv;
  micDataMode: MicDataMode;
  dryRun: boolean;
  pilotProductLimit: number;
  pilotInquiryLimit: number;
  parserAccuracyAbort: number;
}

export function parseAppEnv(raw: string | undefined): AppEnv {
  const v = (raw ?? 'development').toLowerCase();
  if (v === 'production' || v === 'prod') return 'production';
  if (v === 'staging' || v === 'stage') return 'staging';
  return 'development';
}

export function parseMicDataMode(raw: string | undefined, appEnv: AppEnv): MicDataMode {
  const v = (raw ?? '').toLowerCase();
  if (v === 'live') return 'live';
  if (v === 'fixture' || v === 'demo') return 'fixture';
  return appEnv === 'production' ? 'live' : 'fixture';
}

export function parseBool(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw == null || raw === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

export function loadRuntimeSafety(env: NodeJS.Dict<string> = process.env): RuntimeSafety {
  const appEnv = parseAppEnv(env.APP_ENV ?? env.NODE_ENV);
  const micDataMode = parseMicDataMode(env.MIC_DATA_MODE, appEnv);
  const dryRun = parseBool(env.DRY_RUN, true);
  const pilotProductLimit = Math.max(1, Number(env.PILOT_PRODUCT_LIMIT ?? 20) || 20);
  const pilotInquiryLimit = Math.max(1, Number(env.PILOT_INQUIRY_LIMIT ?? 50) || 50);
  const parserAccuracyAbort = Number(env.PARSER_ACCURACY_ABORT ?? 0.8) || 0.8;
  return { appEnv, micDataMode, dryRun, pilotProductLimit, pilotInquiryLimit, parserAccuracyAbort };
}

export function assertLiveModeAllowed(safety: RuntimeSafety, requestedMode: MicDataMode): void {
  if (safety.appEnv === 'production' && safety.micDataMode === 'live' && requestedMode === 'fixture') {
    throw new Error('MIC_FIXTURE_FORBIDDEN');
  }
}
