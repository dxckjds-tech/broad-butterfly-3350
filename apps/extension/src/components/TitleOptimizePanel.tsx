import { useEffect, useState } from 'react';
import type { PlatformPageData, TitleOptimizePayload } from '@trade-ai/shared-types';
import { AI_UNAVAILABLE_COPY, optimizeMicTitle } from '../services/ai';

const STYLE_LABEL: Record<string, string> = {
  SEO_BALANCED: '推荐标题 A · SEO Balanced',
  BUYER_INTENT: '推荐标题 B · Buyer Intent',
  GEO_FRIENDLY: '推荐标题 C · GEO Friendly',
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
}: {
  page: PlatformPageData | null;
  trigger?: number;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<TitleOptimizePayload | null>(null);

  async function run(): Promise<void> {
    if (!page?.productName && !page?.title) {
      setError('当前页面没有可读标题。');
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
      });
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error && err.message ? err.message : AI_UNAVAILABLE_COPY);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (trigger > 0) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only fire when issue-card requests a run
  }, [trigger]);

  if (!page || (page.pageType === 'UNKNOWN' && !page.productName)) return null;

  return (
    <section className="ai-title">
      <div className="ai-title__head">
        <h3>AI 标题优化</h3>
        <button type="button" onClick={() => void run()} disabled={loading || !(page.productName || page.title)}>
          {loading ? 'AI分析中...' : 'AI生成'}
        </button>
      </div>
      <p className="eyebrow">只生成建议，不会写回 MIC 表单。</p>
      {error ? <p className="ai-title__error">{error}</p> : null}
      {result ? (
        <div className="ai-title__body">
          <p>
            <strong>原标题</strong>
            <br />
            {result.originalTitle}
          </p>
          <p>
            <strong>核心产品词</strong>
            <br />
            {result.coreProductTerm}
          </p>
          <p>
            <strong>存在的问题</strong>
            <br />
            {result.problems.join('；') || '—'}
          </p>
          {result.recommendedTitles.map((row, index) => (
            <article key={row.style} className="ai-title__card">
              <header>
                <span>{STYLE_LABEL[row.style] ?? `推荐标题 ${index + 1}`}</span>
                <button type="button" onClick={() => void copyText(row.title)}>
                  复制
                </button>
              </header>
              <p className="ai-title__rec">{row.title}</p>
              <p>{row.reason}</p>
            </article>
          ))}
          {result.keywordSuggestions.length ? (
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
