import { useEffect, useState } from 'react';
import { AiStatusBar } from '../components/AiStatusBar';
import { IssueList } from '../components/IssueList';
import { MicSyncBar } from '../components/MicSyncBar';
import { ParseStatus } from '../components/ParseStatus';
import { ScoreCard } from '../components/ScoreCard';
import { StatusBlock } from '../components/StatusBlock';
import { TitleOptimizePanel } from '../components/TitleOptimizePanel';
import { KeywordOptimizePanel } from '../components/KeywordOptimizePanel';
import { CategoryCheckPanel } from '../components/CategoryCheckPanel';
import { DescriptionOptimizePanel } from '../components/DescriptionOptimizePanel';
import { GeoAnalysisPanel } from '../components/GeoAnalysisPanel';
import { AppShell, type WorkbenchNavId } from '../components/workbench/AppShell';
import { ComingSoonPanel } from '../components/workbench/ComingSoonPanel';
import { ProductDiagnosisView } from '../components/workbench/ProductDiagnosisView';
import { useDiagnosis } from '../hooks/useDiagnosis';
import { copyRequiresConfirm, useUniversalReasoning } from '../hooks/useUniversalReasoning';
import { pageTypeLabel, platformLabel } from '../utils/labels';
import { EXTENSION_VERSION } from '../services/diagnosis';

type DiagnosisTab = 'identity' | 'keywords' | 'titles' | 'detail';

export function PanelApp() {
  const { state, page, result, error, loadPage, run, setIdentityVerified } = useDiagnosis();
  const reasoning = useUniversalReasoning(page);
  const requireConfirm = copyRequiresConfirm(reasoning);
  const [nav, setNav] = useState<WorkbenchNavId>('diagnosis');
  const [diagTab, setDiagTab] = useState<DiagnosisTab>('identity');
  const [titleTrigger, setTitleTrigger] = useState(0);
  const [keywordTrigger, setKeywordTrigger] = useState(0);
  const [categoryTrigger, setCategoryTrigger] = useState(0);
  const [descriptionTrigger, setDescriptionTrigger] = useState(0);
  const [geoTrigger, setGeoTrigger] = useState(0);
  const [identityTrigger, setIdentityTrigger] = useState(0);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const productName = page?.productName || page?.title || '当前页面';
  const connected = Boolean(page && page.platform !== 'UNKNOWN');

  return (
    <AppShell version={EXTENSION_VERSION} connected={connected} nav={nav} onNav={setNav}>
      <div className="app-toolbar">
        <div>
          <p className="eyebrow">
            {platformLabel(page?.platform ?? 'UNKNOWN')} · {pageTypeLabel(page?.pageType ?? 'UNKNOWN')} · UPI 1.0
          </p>
          <h1>{productName}</h1>
        </div>
        <div className="app-toolbar__actions">
          <button type="button" className="ghost" onClick={() => void loadPage(true)}>
            刷新页面
          </button>
          <button type="button" className="primary app-toolbar__run" disabled={!page || state === 'ANALYZING'} onClick={() => void run()}>
            {state === 'ANALYZING' ? '诊断中…' : '开始诊断'}
          </button>
        </div>
      </div>

      {nav === 'diagnosis' ? (
        <div className="app-tabs" role="tablist">
          {(
            [
              ['identity', '商品识别与诊断'],
              ['keywords', '关键词诊断'],
              ['titles', '标题诊断'],
              ['detail', '详情页诊断'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              className={diagTab === id ? 'app-tabs__item app-tabs__item--active' : 'app-tabs__item'}
              onClick={() => setDiagTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

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
        <StatusBlock title="后端离线" detail="当前版本已改为本地诊断，请点击开始诊断。无需启动 API。" />
      )}
      {state === 'FAILED' && (
        <StatusBlock title="分析失败" detail={error || '诊断请求失败，请稍后重试。'} />
      )}
      {state === 'ANALYZING' && <StatusBlock title="正在分析" detail="规则引擎正在评估当前页面，请稍候…" />}

      <div className="app-status-row">
        <AiStatusBar />
        <MicSyncBar pageUrl={page?.url} />
      </div>

      {page && page.platform !== 'UNKNOWN' && state !== 'ANALYZING' ? <ParseStatus page={page} /> : null}

      {nav === 'diagnosis' && page && diagTab === 'identity' ? (
        <ProductDiagnosisView
          page={page}
          reasoning={reasoning}
          titleTrigger={titleTrigger}
          identityTrigger={identityTrigger}
          requireConfirm={requireConfirm}
          onVerified={(verified) => {
            void setIdentityVerified(verified);
          }}
        />
      ) : null}

      {(nav === 'keywords' || (nav === 'diagnosis' && diagTab === 'keywords')) && (
        <KeywordOptimizePanel page={page} trigger={keywordTrigger} requireConfirm={requireConfirm} />
      )}
      {(nav === 'titles' || (nav === 'diagnosis' && diagTab === 'titles')) && (
        <TitleOptimizePanel page={page} trigger={titleTrigger} requireConfirm={requireConfirm} />
      )}
      {(nav === 'detail' || (nav === 'diagnosis' && diagTab === 'detail')) && (
        <>
          <CategoryCheckPanel page={page} trigger={categoryTrigger} />
          <DescriptionOptimizePanel page={page} trigger={descriptionTrigger} />
          <GeoAnalysisPanel page={page} trigger={geoTrigger} />
        </>
      )}
      {nav === 'compete' ? <ComingSoonPanel title="竞争分析" /> : null}
      {nav === 'buyers' ? <ComingSoonPanel title="买家洞察" /> : null}
      {nav === 'monitor' ? <ComingSoonPanel title="监控中心" /> : null}
      {nav === 'history' ? <ComingSoonPanel title="历史记录" /> : null}

      {result && state === 'SUCCESS' && nav === 'diagnosis' && diagTab === 'detail' ? (
        <>
          {error ? <StatusBlock title="说明" detail={error} /> : null}
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
          <IssueList
            issues={result.issues}
            onTitleAi={() => {
              setNav('titles');
              setDiagTab('titles');
              setTitleTrigger((n) => n + 1);
            }}
            onKeywordAi={() => {
              setNav('keywords');
              setDiagTab('keywords');
              setKeywordTrigger((n) => n + 1);
            }}
            onCategoryAi={() => setCategoryTrigger((n) => n + 1)}
            onDescriptionAi={() => setDescriptionTrigger((n) => n + 1)}
            onGeoAi={() => setGeoTrigger((n) => n + 1)}
            onIdentityFocus={() => {
              setNav('diagnosis');
              setDiagTab('identity');
              setIdentityTrigger((n) => n + 1);
              document.getElementById('product-identity-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          />
        </>
      ) : null}
    </AppShell>
  );
}
