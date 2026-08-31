import { useEffect, useState } from 'react';
import { gateKeywordList, inspectProductIdentity } from '@trade-ai/scoring-rules';
import type { KeywordOptimizePayload, PlatformPageData } from '@trade-ai/shared-types';
import { AI_UNAVAILABLE_COPY, optimizeMicKeywords } from '../services/ai';
import { blockedReasonLabel, keywordGateStatusLabel } from '../utils/labels';

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* ignore */
  }
}

export function KeywordOptimizePanel({
  page,
  trigger = 0,
  requireConfirm = false,
}: {
  page: PlatformPageData | null;
  trigger?: number;
  requireConfirm?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<KeywordOptimizePayload | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const current = page?.keywords?.length ? page.keywords : page?.primaryKeywords ?? [];
  const identity = page ? inspectProductIdentity(page) : null;
  const paused =
    !page?.identityUserVerified &&
    Boolean(result?.keywordRecommendationsPaused ?? identity?.keywordRecommendationsPaused);
  const localGate = page ? gateKeywordList(current, page, identity?.profile) : null;

  async function run(): Promise<void> {
    if (!page?.productName && !page?.title) {
      setError('当前页面没有可读标题，无法优化关键词。');
      return;
    }
    if (paused && !page.identityUserVerified) {
      setError('存在 PRODUCT_IDENTITY_CONFLICT，已暂停关键词推荐。请先人工确认产品身份。');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await optimizeMicKeywords({
        productName: page.productName || page.title,
        category: page.category,
        keywords: page.keywords,
        currentKeywords: current,
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
      if (data.keywordRecommendationsPaused) {
        setError(data.problems[0] || '产品身份冲突，已暂停关键词推荐。');
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

  const blocked = result?.blockedKeywords ?? localGate?.blocked ?? [];
  const gated = result?.gatedKeywords ?? localGate?.gated ?? [];
  const officialTop3 = result?.officialTop3 ?? [];
  const copyBlocked = requireConfirm && !confirmed;

  return (
    <section className="ai-title">
      <div className="ai-title__head">
        <h3>AI 关键词优化</h3>
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading || paused || !(page.productName || page.title)}
        >
          {loading ? 'AI分析中...' : paused ? '已暂停' : 'AI生成'}
        </button>
      </div>
      <p className="eyebrow">只生成建议，不会写回 MIC 表单。无真实搜索数据时 demand=UNKNOWN，不能进入正式 Top3。DRY_RUN。</p>
      {requireConfirm ? (
        <label className="ai-upi__confirm">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          存在冲突或低置信度，复制关键词前需确认产品身份。
        </label>
      ) : null}
      {paused ? (
        <p className="ai-title__error">PRODUCT_IDENTITY_CONFLICT：请先在上方确认产品身份，确认前不生成关键词推荐。</p>
      ) : null}
      {error ? <p className="ai-title__error">{error}</p> : null}
      <div className="ai-kw">
        <p>
          <strong>当前关键词</strong>
        </p>
        <p>{current.length ? current.join(' / ') : '（未识别到后台关键词）'}</p>
        {blocked.length ? (
          <>
            <p>
              <strong>已拦截关键词</strong>
            </p>
            <ul className="ai-kw__list">
              {blocked.map((row) => (
                <li key={`blocked-${row.keyword}`}>
                  <span>
                    {row.keyword}
                    <em>{row.reasons.map(blockedReasonLabel).join(' / ')}</em>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <p>
          <strong>正式 Top3</strong>
        </p>
        {officialTop3.length ? (
          <ol className="ai-kw__list">
            {officialTop3.map((row, index) => (
              <li key={`top3-${row.keyword}`}>
                <span>
                  {index + 1}. {row.keyword}
                  <em>{keywordGateStatusLabel(row.status)} · {row.matchScore}</em>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="eyebrow">无 VERIFIED 搜索证据，正式 Top3 为空（demand=UNKNOWN，禁止伪造搜索量）。</p>
        )}
        <p className="ai-kw__arrow">↓</p>
        {result && !result.keywordRecommendationsPaused ? (
          <>
            <div className="ai-title__head">
              <strong>AI推荐关键词（候选，非正式 Top3）</strong>
              <button
                type="button"
                onClick={() => void copyText(result.micKeywords.map((k) => k.keyword).join('\n'))}
                disabled={copyBlocked}
              >
                {copyBlocked ? '需确认后复制' : '复制全部'}
              </button>
            </div>
            {result.problems.length ? (
              <p className="eyebrow">问题：{result.problems.join('；')}</p>
            ) : null}
            <ol className="ai-kw__list">
              {result.micKeywords.map((row, index) => (
                <li key={`${row.keyword}-${index}`}>
                  <span>
                    {index + 1}. {row.keyword}
                    {row.priority === 'HIGH' ? <em>核心关键词</em> : null}
                    {row.gateStatus ? <em>{keywordGateStatusLabel(row.gateStatus)}</em> : null}
                    {typeof row.matchScore === 'number' ? <em>{row.matchScore}</em> : null}
                  </span>
                  <button type="button" onClick={() => void copyText(row.keyword)} disabled={copyBlocked}>
                    {copyBlocked ? '需确认' : '复制'}
                  </button>
                </li>
              ))}
            </ol>
          </>
        ) : gated.length ? (
          <>
            <p>
              <strong>当前词门禁</strong>
            </p>
            <ul className="ai-kw__list">
              {gated.map((row) => (
                <li key={`gate-${row.keyword}`}>
                  <span>
                    {row.keyword}
                    <em>
                      {keywordGateStatusLabel(row.status)} · {row.matchScore}
                    </em>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </section>
  );
}
