import { useEffect } from 'react';
import { IssueList } from '../components/IssueList';
import { ScoreCard } from '../components/ScoreCard';
import { StatusBlock } from '../components/StatusBlock';
import { useDiagnosis } from '../hooks/useDiagnosis';
import { pageTypeLabel, platformLabel } from '../utils/labels';

export function PanelApp() {
  const { state, page, result, error, loadPage, run } = useDiagnosis();

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const productName = page?.productName || page?.title || '当前页面';

  return (
    <div className="panel">
      <header className="panel__header">
        <div>
          <h1>AI 店铺医生</h1>
          <p>当前平台：{platformLabel(page?.platform ?? 'UNKNOWN')}</p>
          <p>当前页面类型：{pageTypeLabel(page?.pageType ?? 'UNKNOWN')}</p>
        </div>
        <button type="button" className="ghost" onClick={() => void loadPage()}>
          刷新页面
        </button>
      </header>

      <section className="panel__page">
        <span className="eyebrow">当前页面</span>
        <h2>{productName}</h2>
      </section>

      {state === 'UNRECOGNIZED' && (
        <StatusBlock
          title="未识别页面"
          detail="请打开 Made-in-China.com 产品页或店铺页后再诊断。本地演示页：Admin /demo/mic-product.html"
        />
      )}
      {state === 'CAPTURE_FAILED' && (
        <StatusBlock title="页面读取失败" detail="无法读取当前标签页。请刷新页面后重试，或确认已授权读取该站点。" />
      )}
      {state === 'OFFLINE' && (
        <StatusBlock title="后端离线" detail={error || '无法连接 API。请先启动 pnpm dev:api。'} />
      )}
      {state === 'FAILED' && (
        <StatusBlock title="分析失败" detail={error || '诊断请求失败，请稍后重试。'} />
      )}
      {state === 'ANALYZING' && <StatusBlock title="正在分析" detail="规则引擎正在评估当前页面，请稍候…" />}

      <div className="panel__cta">
        <button
          type="button"
          className="primary"
          disabled={!page || state === 'ANALYZING' || state === 'UNRECOGNIZED'}
          onClick={() => void run()}
        >
          {state === 'ANALYZING' ? '诊断中…' : '开始诊断'}
        </button>
      </div>

      {result && state === 'SUCCESS' && (
        <>
          <section className="health">
            <span>综合健康度</span>
            <strong>
              {result.totalScore} <small>/ 100</small>
            </strong>
          </section>
          <div className="score-grid">
            <ScoreCard label="MIC SEO" value={result.scores.micSeo} />
            <ScoreCard label="Google SEO" value={result.scores.googleSeo} />
            <ScoreCard label="GEO / AI Visibility" value={result.scores.geo} />
            <ScoreCard label="内容质量" value={result.scores.contentQuality} />
            <ScoreCard label="B2B 转化" value={result.scores.b2bConversion} />
          </div>
          <IssueList issues={result.issues} />
        </>
      )}
    </div>
  );
}
