import { describe, expect, it } from 'vitest';
import { mapProductStatus } from '../products/parse';

describe('mic-product-status', () => {
  it('maps MIC VO labels', () => {
    expect(mapProductStatus('展示中')).toBe('ONLINE');
    expect(mapProductStatus('Pending Review')).toBe('PENDING_REVIEW');
  });
});
