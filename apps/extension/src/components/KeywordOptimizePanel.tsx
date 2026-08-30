import { useEffect, useState } from 'react';
import type { KeywordOptimizePayload, PlatformPageData } from '@trade-ai/shared-types';
import { AI_UNAVAILABLE_COPY, optimizeMicKeywords } from '../services/ai';

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
}: {
  page: PlatformPageData | null;
  trigger?: number;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<KeywordOptimizePayload | null>(null);

  const current = page?.keywords?.length ? page.keywords : page?.primaryKeywords ?? [];

  async function run(): Promise<void> {
    if (!page?.productName && !page?.title) {
      setError('当前页面没有可读标题，无法优化关键词。');
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
        <h3>AI 关键词优化</h3>
        <button type="button" onClick={() => void run()} disabled={loading || !(page.productName || page.title)}>
          {loading ? 'AI分析中...' : 'AI生成'}
        </button>
      </div>
      <p className="eyebrow">只生成建议，不会写回 MIC 表单。</p>
      {error ? <p className="ai-title__error">{error}</p> : null}
      <div className="ai-kw">
        <p>
          <strong>当前关键词</strong>
        </p>
        <p>{current.length ? current.join(' / ') : '（未识别到后台关键词）'}</p>
        <p className="ai-kw__arrow">↓</p>
        {result ? (
          <>
            <div className="ai-title__head">
              <strong>AI推荐关键词</strong>
              <button
                type="button"
                onClick={() => void copyText(result.micKeywords.map((k) => k.keyword).join('\n'))}
              >
                复制全部
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
                  </span>
                  <button type="button" onClick={() => void copyText(row.keyword)}>
                    复制
                  </button>
                </li>
              ))}
            </ol>
          </>
        ) : null}
      </div>
    </section>
  );
}
