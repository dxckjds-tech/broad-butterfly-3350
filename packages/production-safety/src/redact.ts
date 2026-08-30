const SECRET_KEYS = /password|passwd|cookie|set-cookie|token|captcha|sms|otp|sessionid|authorization/i;

export function redactAuditPayload(input: unknown): unknown {
  if (input == null) return input;
  if (typeof input === 'string') {
    if (SECRET_KEYS.test(input)) return '[redacted]';
    return input.replace(/([A-Za-z0-9+/]{24,}={0,2})/g, '[redacted-blob]');
  }
  if (Array.isArray(input)) return input.map(redactAuditPayload);
  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = SECRET_KEYS.test(k) ? '[redacted]' : redactAuditPayload(v);
    }
    return out;
  }
  return input;
}

export function sampleIds<T>(items: T[], n: number, seed = 1): T[] {
  if (items.length <= n) return items.slice();
  const copy = items.slice();
  let s = seed;
  for (let i = copy.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    const a = copy[i];
    const b = copy[j];
    if (a === undefined || b === undefined) continue;
    copy[i] = b;
    copy[j] = a;
  }
  return copy.slice(0, n);
}
