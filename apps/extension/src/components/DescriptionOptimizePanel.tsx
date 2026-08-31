import { useEffect, useState } from 'react';
import type { DescriptionOptimizePayload, PlatformPageData } from '@trade-ai/shared-types';
import { AI_UNAVAILABLE_COPY, optimizeMicDescription } from '../services/ai';

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* ignore */
  }
}

function preview(text: string, max = 220): string {
  const t = text.trim();
  if (!t) return '（未识别到产品描述）';
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export function DescriptionOptimizePanel({
  page,
  trigger = 0,
}: {
  page: PlatformPageData | null;
  trigger?: number;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<DescriptionOptimizePayload | null>(null);

  const current = page?.description?.trim() || '';

  async function run(): Promise<void> {
    if (!page?.productName && !page?.title) {
      setError('当前页面没有可读标题，无法优化描述。');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await optimizeMicDescription({
        productName: page.productName || page.title,
        category: page.category,
        keywords: page.keywords,
        currentKeywords: page.keywords,
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
        <h3>AI 描述优化</h3>
        <button type="button" onClick={() => void run()} disabled={loading || !(page.productName || page.title)}>
          {loading ? 'AI分析中...' : 'AI生成'}
        </button>
      </div>
      <p className="eyebrow">只生成建议，不会写回 MIC 表单。不编造认证、MOQ、交期或工厂规模。</p>
      {error ? <p className="ai-title__error">{error}</p> : null}
      <div className="ai-desc">
        <p>
          <strong>当前描述</strong>
        </p>
        <p className="ai-desc__current">{preview(current)}</p>
        {result ? (
          <>
            <p className="ai-kw__arrow">↓</p>
            <div className="ai-title__head">
              <strong>AI 推荐描述</strong>
              <button type="button" onClick={() => void copyText(result.recommendedDescription)}>
                复制全文
              </button>
            </div>
            {result.problems.length ? (
              <p className="eyebrow">问题：{result.problems.join('；')}</p>
            ) : null}
            {result.sections.map((row) => (
              <article key={row.heading} className="ai-title__card">
                <header>
                  <span>{row.title}</span>
                  <button type="button" onClick={() => void copyText(row.body)}>
                    复制
                  </button>
                </header>
                <p className="ai-desc__body">{row.body}</p>
              </article>
            ))}
          </>
        ) : null}
      </div>
    </section>
  );
}
