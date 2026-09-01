import { useEffect, useState } from 'react';
import { inspectProductIdentity } from '@trade-ai/scoring-rules';
import type { PlatformPageData, TitleOptimizePayload } from '@trade-ai/shared-types';
import { titleMatchesTrustedIdentity } from '@trade-ai/universal-product-intelligence';
import { AI_UNAVAILABLE_COPY, optimizeMicTitle } from '../services/ai';
import { titlePlanScore, titleRiskLabel } from '../utils/title-plan';

const STYLE_LABEL: Record<string, string> = {
  SEO_BALANCED: '方案 A · 搜索精准',
  BUYER_INTENT: '方案 B · 买家意图',
  GEO_FRIENDLY: '方案 C · GEO 友好',
};

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* ignore */
  }
}

export function TitleOptimizePanel({
  page,
  trigger = 0,
  requireConfirm = false,
  layout = 'stack',
  showKeywordSuggestions = true,
}: {
  page: PlatformPageData | null;
  trigger?: number;
  requireConfirm?: boolean;
  layout?: 'stack' | 'plans';
  showKeywordSuggestions?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<TitleOptimizePayload | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const identity = page ? inspectProductIdentity(page) : null;
  const paused =
    !page?.identityUserVerified &&
    Boolean(result?.titleRecommendationsPaused ?? identity?.keywordRecommendationsPaused);

  async function run(): Promise<void> {
    if (!page?.productName && !page?.title) {
      setError('当前页面没有可读标题。');
      return;
    }
    if (paused && !page.identityUserVerified) {
      setError('存在 PRODUCT_IDENTITY_CONFLICT，已暂停标题生成。请先人工确认产品身份。');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await optimizeMicTitle({
        productName: page.productName || page.title,
        category: page.category,
        keywords: page.keywords,
        centerTerms: page.centerTerms,
        specifications: page.specifications,
        description: page.description,
        certifications: page.certifications,
        url: page.url,
        moq: page.moq,
        deliveryTime: page.deliveryTime,
        identityUserVerified: page.identityUserVerified,
      });
      setResult(data);
      if (data.titleRecommendationsPaused) {
        setError(data.problems[0] || '产品身份冲突，已暂停标题生成。');
      }
    } catch (err) {
      setResult(null);
      setError(err instanceof Error && err.message ? err.message : AI_UNAVAILABLE_COPY);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (page?.identityUserVerified) setResult(null);
  }, [page?.identityUserVerified]);

  useEffect(() => {
    if (trigger > 0) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only fire when issue-card requests a run
  }, [trigger]);

  if (!page || (page.pageType === 'UNKNOWN' && !page.productName)) return null;
  const copyBlocked = requireConfirm && !confirmed;
  const trusted = result?.trustedIdentity || result?.coreProductTerm || '';

  return (
    <section className={layout === 'plans' ? 'wb-titles' : 'ai-title'} id="title-optimize-panel">
      <div className={layout === 'plans' ? 'wb-titles__head' : 'ai-title__head'}>
        <h3>{layout === 'plans' ? '推荐标题方案' : 'AI 标题优化'}</h3>
        <button type="button" onClick={() => void run()} disabled={loading || paused || !(page.productName || page.title)}>
          {loading ? 'AI分析中...' : paused ? '已暂停' : 'AI生成'}
        </button>
      </div>
      <p className="eyebrow">只生成建议，不会写回 MIC 表单。认证/材质/容量/功率/应用仅来自已验证结构化事实。DRY_RUN。</p>
      {requireConfirm ? (
        <label className="ai-upi__confirm">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          存在冲突或低置信度，复制标题前需确认产品身份。
        </label>
      ) : null}
      {paused ? (
        <p className="ai-title__error">PRODUCT_IDENTITY_CONFLICT：请先确认产品身份，确认前不生成标题。</p>
      ) : null}
      {error ? <p className="ai-title__error">{error}</p> : null}
      {result ? (
        <div className={layout === 'plans' ? 'wb-titles__body' : 'ai-title__body'}>
          {layout === 'stack' ? (
            <>
              <p>
                <strong>原标题</strong>
                <br />
                {result.originalTitle}
              </p>
              <p>
                <strong>可信身份</strong>
                <br />
                {result.trustedIdentity || result.coreProductTerm}
              </p>
              <p>
                <strong>存在的问题</strong>
                <br />
                {result.problems.join('；') || '—'}
              </p>
            </>
          ) : null}
          {result.recommendedTitles.map((row, index) => {
            const score = titlePlanScore(row.title, trusted, row.warnings);
            const matched = titleMatchesTrustedIdentity(row.title, trusted);
            return (
              <article key={row.style} className={layout === 'plans' ? 'wb-plan' : 'ai-title__card'}>
                <header>
                  <span>{STYLE_LABEL[row.style] ?? `推荐标题 ${index + 1}`}</span>
                  {layout === 'plans' ? <em className="wb-plan__score">{score}/100</em> : null}
                  <button type="button" onClick={() => void copyText(row.title)} disabled={copyBlocked}>
                    {copyBlocked ? '需确认后复制' : '复制英文'}
                  </button>
                </header>
                <p className={layout === 'plans' ? 'wb-plan__title' : 'ai-title__rec'}>{row.title}</p>
                {layout === 'plans' ? (
                  <ul className="wb-plan__meta">
                    <li>长度 {row.title.length}/120</li>
                    <li>产品匹配 {matched ? '通过' : '未通过'}</li>
                    <li>风险 {titleRiskLabel(row, Boolean(result.titleRecommendationsPaused))}</li>
                  </ul>
                ) : (
                  <p>{row.reason}</p>
                )}
              </article>
            );
          })}
          {showKeywordSuggestions && result.keywordSuggestions.length ? (
            <p>
              <strong>前三关键词建议</strong>
              <br />
              {result.keywordSuggestions.join(' / ')}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
