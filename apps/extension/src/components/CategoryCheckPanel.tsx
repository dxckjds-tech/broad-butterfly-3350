import { useEffect, useState } from 'react';
import type { CategoryCheckPayload, PlatformPageData } from '@trade-ai/shared-types';
import { AI_UNAVAILABLE_COPY, checkMicCategory } from '../services/ai';
import { categoryVerdictLabel } from '../utils/labels';

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* ignore */
  }
}

function formatResult(result: CategoryCheckPayload): string {
  const pct = `${Math.round(result.confidence * 100)}%`;
  return [
    `当前类目：${result.currentCategory}`,
    `AI判断：${categoryVerdictLabel(result.verdict)}`,
    `置信度：${pct}`,
    `问题说明：${result.reason}`,
    `建议方向：${result.suggestedCategoryConcept}`,
  ].join('\n');
}

export function CategoryCheckPanel({
  page,
  trigger = 0,
}: {
  page: PlatformPageData | null;
  trigger?: number;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CategoryCheckPayload | null>(null);

  const currentCategory = page?.category?.trim() || '';

  async function run(): Promise<void> {
    if (!page?.productName && !page?.title) {
      setError('当前页面没有可读标题，无法判断类目。');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await checkMicCategory({
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

  const verdictTone = result?.verdict.toLowerCase().replace(/_/g, '-') ?? '';

  return (
    <section className="ai-title">
      <div className="ai-title__head">
        <h3>AI 类目判断</h3>
        <button type="button" onClick={() => void run()} disabled={loading || !(page.productName || page.title)}>
          {loading ? 'AI分析中...' : 'AI生成'}
        </button>
      </div>
      <p className="eyebrow">只给出类目概念建议，不会修改 MIC 已选子目录，也不改规则分。</p>
      {error ? <p className="ai-title__error">{error}</p> : null}
      <div className="ai-cat">
        <p>
          <strong>当前类目</strong>
        </p>
        <p>{currentCategory || '（未识别类目）'}</p>
        {result ? (
          <>
            <p className="ai-kw__arrow">↓</p>
            <div className="ai-title__head">
              <strong>AI 判断结果</strong>
              <button type="button" onClick={() => void copyText(formatResult(result))}>
                复制全部
              </button>
            </div>
            <p>
              <strong>AI判断</strong>{' '}
              <span className={`ai-cat__verdict ai-cat__verdict--${verdictTone}`}>
                {categoryVerdictLabel(result.verdict)}
              </span>
            </p>
            <p>
              <strong>置信度</strong> {Math.round(result.confidence * 100)}%
            </p>
            <article className="ai-title__card">
              <header>
                <span>问题说明</span>
                <button type="button" onClick={() => void copyText(result.reason)}>
                  复制
                </button>
              </header>
              <p>{result.reason}</p>
            </article>
            <article className="ai-title__card">
              <header>
                <span>建议方向</span>
                <button type="button" onClick={() => void copyText(result.suggestedCategoryConcept)}>
                  复制
                </button>
              </header>
              <p className="ai-title__rec">{result.suggestedCategoryConcept}</p>
              <p className="eyebrow">这是产品类型概念，不是 MIC 官方类目 ID，请人工改类目。</p>
            </article>
          </>
        ) : null}
      </div>
    </section>
  );
}
