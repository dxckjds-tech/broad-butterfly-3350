import { useState } from 'react';
import { inspectProductIdentity } from '@trade-ai/scoring-rules';
import type { PlatformPageData } from '@trade-ai/shared-types';
import { AI_UNAVAILABLE_COPY, confirmMicProductIdentity } from '../../services/ai';
import { setIdentityUserVerified } from '../../services/identity';

export function IdentityConfirmBar({
  page,
  onVerified,
}: {
  page: PlatformPageData;
  onVerified: (verified: boolean) => void;
}) {
  const identity = inspectProductIdentity(page);
  const verified = Boolean(page.identityUserVerified || identity.profile.userVerified);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function confirm(): Promise<void> {
    if (!page.url) {
      setError('当前页面没有 URL，无法保存身份确认。');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await setIdentityUserVerified(page.url, true);
      try {
        await confirmMicProductIdentity({
          url: page.url,
          productName: page.productName || page.title,
          category: page.category,
          keywords: page.keywords,
          userVerified: true,
        });
      } catch {
        /* local confirm still counts when API is offline */
      }
      onVerified(true);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : AI_UNAVAILABLE_COPY);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="wb-confirm" id="product-identity-panel">
      <p className="eyebrow">确认后才生成标题和关键词。确认只锁定产品身份，不会把描述里的认证写成已验证事实。</p>
      {error ? <p className="ai-title__error">{error}</p> : null}
      <button type="button" className="primary wb-confirm__btn" onClick={() => void confirm()} disabled={saving || verified || !page.url}>
        {verified ? '身份已确认' : saving ? '确认中…' : '人工确认产品身份'}
      </button>
    </div>
  );
}
