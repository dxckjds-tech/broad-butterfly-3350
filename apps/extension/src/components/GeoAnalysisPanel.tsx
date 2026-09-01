import { useEffect, useState } from 'react';
import type { GeoAnalysisPayload, PlatformPageData } from '@trade-ai/shared-types';
import { AI_UNAVAILABLE_COPY, analyzeMicGeo } from '../services/ai';
import { geoGapDimensionLabel, geoGapStatusLabel, geoVerdictLabel } from '../utils/labels';

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* ignore */
  }
}

function verdictTone(verdict: string): string {
  if (verdict === 'STRONG') return 'match';
  if (verdict === 'PARTIAL') return 'possible-mismatch';
  if (verdict === 'WEAK') return 'mismatch';
  return 'uncertain';
}

function formatResult(result: GeoAnalysisPayload): string {
  const pct = `${Math.round(result.score * 100)}%`;
  const gaps = result.gaps
    .map((g) => `- ${geoGapDimensionLabel(g.dimension)}：${geoGapStatusLabel(g.status)}。${g.note}`)
    .join('\n');
  const recs = result.recommendations.map((r) => `## ${r.title}\n${r.body}`).join('\n\n');
  const faqs = result.faqSuggestions.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n');
  return [
    `产品实体：${result.productEntity}`,
    `公司实体：${result.companyEntity || '（未识别）'}`,
    `GEO判断：${geoVerdictLabel(result.verdict)}`,
    `分数：${pct}`,
    `摘要：${result.summary}`,
    '',
    '缺口：',
    gaps,
    '',
    '建议：',
    recs,
    '',
    'FAQ 建议：',
    faqs,
  ].join('\n');
}

export function GeoAnalysisPanel({
  page,
  trigger = 0,
}: {
  page: PlatformPageData | null;
  trigger?: number;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<GeoAnalysisPayload | null>(null);

  async function run(): Promise<void> {
    if (!page?.productName && !page?.title) {
      setError('当前页面没有可读标题，无法做 GEO 分析。');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await analyzeMicGeo({
        productName: page.productName || page.title,
        companyName: page.companyName,
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

  const tone = result ? verdictTone(result.verdict) : '';

  return (
    <section className="ai-title">
      <div className="ai-title__head">
        <h3>AI GEO 可见性</h3>
        <button type="button" onClick={() => void run()} disabled={loading || !(page.productName || page.title)}>
          {loading ? 'AI分析中...' : 'AI生成'}
        </button>
      </div>
      <p className="eyebrow">评估 AI 是否容易理解并引用这条 listing。只给建议，不写回 MIC，不改规则分。</p>
      {error ? <p className="ai-title__error">{error}</p> : null}
      <div className="ai-cat">
        <p>
          <strong>产品实体</strong> {page.productName || page.title || '（未识别）'}
        </p>
        <p>
          <strong>公司实体</strong> {page.companyName || '（未识别）'}
        </p>
        {result ? (
          <>
            <p className="ai-kw__arrow">↓</p>
            <div className="ai-title__head">
              <strong>AI GEO 判断</strong>
              <button type="button" onClick={() => void copyText(formatResult(result))}>
                复制全部
              </button>
            </div>
            <p>
              <strong>GEO判断</strong>{' '}
              <span className={`ai-cat__verdict ai-cat__verdict--${tone}`}>{geoVerdictLabel(result.verdict)}</span>
            </p>
            <p>
              <strong>分数</strong> {Math.round(result.score * 100)}%
            </p>
            <article className="ai-title__card">
              <header>
                <span>摘要</span>
                <button type="button" onClick={() => void copyText(result.summary)}>
                  复制
                </button>
              </header>
              <p>{result.summary}</p>
            </article>
            <p>
              <strong>缺口</strong>
            </p>
            <ul className="ai-geo__gaps">
              {result.gaps.map((gap) => (
                <li key={gap.dimension}>
                  <span>
                    {geoGapDimensionLabel(gap.dimension)}{' '}
                    <em className={`ai-geo__status ai-geo__status--${gap.status.toLowerCase()}`}>
                      {geoGapStatusLabel(gap.status)}
                    </em>
                  </span>
                  <span>{gap.note}</span>
                </li>
              ))}
            </ul>
            {result.recommendations.map((row) => (
              <article key={row.title} className="ai-title__card">
                <header>
                  <span>{row.title}</span>
                  <button type="button" onClick={() => void copyText(row.body)}>
                    复制
                  </button>
                </header>
                <p className="ai-desc__body">{row.body}</p>
              </article>
            ))}
            <div className="ai-title__head">
              <strong>FAQ 建议</strong>
              <button
                type="button"
                onClick={() =>
                  void copyText(result.faqSuggestions.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n'))
                }
              >
                复制全部 FAQ
              </button>
            </div>
            {result.faqSuggestions.map((row) => (
              <article key={row.question} className="ai-title__card">
                <header>
                  <span>{row.question}</span>
                  <button type="button" onClick={() => void copyText(`Q: ${row.question}\nA: ${row.answer}`)}>
                    复制
                  </button>
                </header>
                <p className="ai-desc__body">{row.answer}</p>
              </article>
            ))}
          </>
        ) : null}
      </div>
    </section>
  );
}
