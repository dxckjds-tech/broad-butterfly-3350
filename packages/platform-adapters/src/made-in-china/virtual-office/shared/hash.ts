export function stableHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `h${(h >>> 0).toString(16)}`;
}

export function normalizeProductName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function productKey(micProductId: string, productUrl: string, productName: string): {
  key: string;
  idConfidence: number;
} {
  const id = micProductId.trim();
  if (id && !/^unknown$/i.test(id)) {
    return { key: id, idConfidence: 0.95 };
  }
  const url = productUrl.trim();
  const name = normalizeProductName(productName);
  if (url && name) {
    return { key: `prov:${stableHash(`${url}|${name}`)}`, idConfidence: 0.55 };
  }
  return { key: `prov:${stableHash(name || url || 'empty')}`, idConfidence: 0.2 };
}

export function recordHash(parts: Record<string, unknown>): string {
  return stableHash(JSON.stringify(parts));
}

const SECRET_KEYS = /password|cookie|sms|token|authorization|session/i;

export function assertNoSecrets(payload: unknown): void {
  const text = JSON.stringify(payload);
  if (SECRET_KEYS.test(text) && /(cookieValue|password|smsCode|sessionToken)/i.test(text)) {
    throw new Error('SECURITY: secret-like fields are not allowed in sync payload');
  }
}

export function redactSecrets<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item)) as T;
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEYS.test(k)) continue;
      out[k] = redactSecrets(v);
    }
    return out as T;
  }
  return value;
}
