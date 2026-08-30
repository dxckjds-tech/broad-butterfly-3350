import { describe, expect, it } from 'vitest';
import { redactSecrets, assertNoSecrets } from '../shared/hash';

describe('mic-sync-security', () => {
  it('strips secret-like keys from payloads', () => {
    const clean = redactSecrets({
      products: 1,
      cookieValue: 'SHOULD_NOT_KEEP',
      password: 'x',
      smsCode: '123',
      sessionToken: 'abc',
    });
    const text = JSON.stringify(clean);
    expect(text).not.toContain('SHOULD_NOT_KEEP');
    expect(text).not.toContain('cookieValue');
    expect(text).not.toContain('password');
  });

  it('rejects payloads that still embed secret field names', () => {
    expect(() => assertNoSecrets({ cookieValue: 'abc' })).toThrow(/SECURITY/);
  });
});
