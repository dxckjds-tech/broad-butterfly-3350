import { useEffect, useState } from 'react';
import { inspectProductIdentity } from '@trade-ai/scoring-rules';
import type { PlatformPageData, ProductIdentityInspectPayload } from '@trade-ai/shared-types';
import { AI_UNAVAILABLE_COPY, confirmMicProductIdentity, inspectMicProductIdentity } from '../services/ai';
import { setIdentityUserVerified } from '../services/identity';

export function ProductIdentityPanel({
  page,
  trigger = 0,
  onVerified,
}: {
  page: PlatformPageData | null;
  trigger?: number;
  onVerified?: (verified: boolean) => void;
}) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [remote, setRemote] = useState<ProductIdentityInspectPayload | null>(null);

  const local = page ? inspectProductIdentity(page) : null;
  const profile = remote?.profile ?? local?.profile;
  const conflict = remote?.conflict ?? local?.conflict ?? null;
  const paused = remote?.keywordRecommendationsPaused ?? local?.keywordRecommendationsPaused ?? false;

  useEffect(() => {
    if (!page?.productName && !page?.title) return;
    let cancelled = false;
    void inspectMicProductIdentity({
      productName: page.productName || page.title,
      category: page.category,
      keywords: page.keywords,
      currentKeywords: page.keywords,
      centerTerms: page.centerTerms,
      specifications: page.specifications,
      description: page.description,
      certifications: page.certifications,
      url: page.url,
      identityUserVerified: page.identityUserVerified,
    })
      .then((data) => {
        if (!cancelled) {
          setRemote(data);
          setError('');
        }
      })
      .catch(() => {
        if (!cancelled) setRemote(null);
      });
    return () => {
      cancelled = true;
    };
  }, [page, trigger]);

  async function confirm(): Promise<void> {
    if (!page?.url) {
      setError('当前页面没有 URL，无法保存身份确认。');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await setIdentityUserVerified(page.url, true);
      try {
        const data = await confirmMicProductIdentity({
          url: page.url,
          productName: page.productName || page.title,
          category: page.category,
          keywords: page.keywords,
          userVerified: true,
        });
        setRemote(data);
      } catch {
        /* local confirm still counts when API is offline */
      }
      onVerified?.(true);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : AI_UNAVAILABLE_COPY);
    } finally {
      setSaving(false);
    }
  }

  if (!page || (page.pageType === 'UNKNOWN' && !page.productName) || !profile) return null;

  return (
    <section className="ai-title ai-identity" id="product-identity-panel">
      <div className="ai-title__head">
        <h3>产品身份</h3>
        {paused ? <span className="ai-identity__badge">关键词已暂停</span> : null}
      </div>
      <p className="eyebrow">真实产品事实 → 产品身份 → 关键词门禁 → AI。确认后 AI 不得覆盖身份。</p>
      <p>
        <strong>核心产品</strong> {profile.coreProduct}
      </p>
      <p>
        <strong>产品族</strong> {profile.productFamily}
      </p>
      <p>
        <strong>产品类型</strong> {profile.productType}
      </p>
      <p>
        <strong>身份置信度</strong> {Math.round(profile.identityConfidence * 100)}%
        {profile.userVerified ? ' · 已人工确认' : ''}
      </p>
      <p>
        <strong>已验证属性</strong>{' '}
        {profile.verifiedAttributes.filter((item) => !item.includes(':')).join(' / ') || '（无，关键词不能自证）'}
      </p>
      {profile.unverifiedClaims.length ? (
        <p>
          <strong>未验证声明</strong> {profile.unverifiedClaims.join(' / ')}
        </p>
      ) : null}
      {conflict ? (
        <div className="ai-identity__conflict">
          <p>
            <strong>{conflict.code}</strong>
          </p>
          <p>{conflict.summary}</p>
        </div>
      ) : (
        <p className="eyebrow">标题、类目、关键词与参数指向同一产品。</p>
      )}
      {error ? <p className="ai-title__error">{error}</p> : null}
      <button type="button" onClick={() => void confirm()} disabled={saving || profile.userVerified || !page.url}>
        {profile.userVerified ? '身份已确认' : saving ? '确认中…' : '人工确认产品身份'}
      </button>
    </section>
  );
}
