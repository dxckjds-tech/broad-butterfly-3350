import { useEffect, useState } from 'react';
import { StatusBlock } from '../components/StatusBlock';
import { TitleOptimizePanel } from '../components/TitleOptimizePanel';
import { KeywordOptimizePanel } from '../components/KeywordOptimizePanel';
import { AppShell, type WorkbenchNavId } from '../components/workbench/AppShell';
import { ComingSoonPanel } from '../components/workbench/ComingSoonPanel';
import { DetailDiagnosisView } from '../components/workbench/DetailDiagnosisView';
import { ProductDiagnosisView } from '../components/workbench/ProductDiagnosisView';
import { WorkbenchChrome } from '../components/workbench/WorkbenchChrome';
import { useDiagnosis } from '../hooks/useDiagnosis';
import { copyRequiresConfirm, useUniversalReasoning } from '../hooks/useUniversalReasoning';
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

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const connected = Boolean(page && page.platform !== 'UNKNOWN');

  function go(nextNav: WorkbenchNavId, nextTab?: DiagnosisTab): void {
    setNav(nextNav);
    if (nextTab) setDiagTab(nextTab);
  }

  function afterIdentityVerified(verified: boolean): void {
    void setIdentityVerified(verified).then(() => {
      if (!verified) return;
      setTitleTrigger((n) => n + 1);
      setKeywordTrigger((n) => n + 1);
    });
  }

  const showDiagnosisTabs = nav === 'diagnosis' || nav === 'keywords' || nav === 'titles' || nav === 'detail';
  const tab: DiagnosisTab =
    nav === 'keywords' ? 'keywords' : nav === 'titles' ? 'titles' : nav === 'detail' ? 'detail' : diagTab;

  return (
    <AppShell
      version={EXTENSION_VERSION}
      connected={connected}
      nav={nav}
      onNav={(id) => {
        setNav(id);
        if (id === 'diagnosis') setDiagTab('identity');
        if (id === 'keywords') setDiagTab('keywords');
        if (id === 'titles') setDiagTab('titles');
        if (id === 'detail') setDiagTab('detail');
      }}
    >
      <WorkbenchChrome
        page={page}
        connected={connected}
        diagnosing={state === 'ANALYZING'}
        onRefresh={() => void loadPage(true)}
        onDiagnose={() => void run()}
      />

      {showDiagnosisTabs ? (
        <div className="app-tabs" role="tablist">
          {(
            [
              ['identity', '商品识别与诊断', 'diagnosis'],
              ['keywords', '关键词诊断', 'keywords'],
              ['titles', '标题诊断', 'titles'],
              ['detail', '详情页诊断', 'detail'],
            ] as const
          ).map(([id, label, targetNav]) => (
            <button
              key={id}
              type="button"
              role="tab"
              className={tab === id ? 'app-tabs__item app-tabs__item--active' : 'app-tabs__item'}
              onClick={() => go(targetNav, id)}
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
      {state === 'FAILED' && <StatusBlock title="分析失败" detail={error || '诊断请求失败，请稍后重试。'} />}
      {state === 'ANALYZING' && <StatusBlock title="正在分析" detail="规则引擎正在评估当前页面，请稍候…" />}

      {tab === 'identity' && page && state !== 'ANALYZING' ? (
        <ProductDiagnosisView
          page={page}
          reasoning={reasoning}
          result={result}
          titleTrigger={titleTrigger}
          keywordTrigger={keywordTrigger}
          requireConfirm={requireConfirm}
          onVerified={afterIdentityVerified}
        />
      ) : null}

      {tab === 'keywords' && (
        <div className="wb">
          <KeywordOptimizePanel page={page} trigger={keywordTrigger} requireConfirm={requireConfirm} layout="workbench" />
        </div>
      )}
      {tab === 'titles' && (
        <div className="wb">
          <TitleOptimizePanel page={page} trigger={titleTrigger} requireConfirm={requireConfirm} layout="plans" />
        </div>
      )}
      {tab === 'detail' && (
        <DetailDiagnosisView
          page={page}
          result={result}
          error={error}
          categoryTrigger={categoryTrigger}
          descriptionTrigger={descriptionTrigger}
          geoTrigger={geoTrigger}
          onTitleAi={() => {
            go('titles', 'titles');
            setTitleTrigger((n) => n + 1);
          }}
          onKeywordAi={() => {
            go('keywords', 'keywords');
            setKeywordTrigger((n) => n + 1);
          }}
          onCategoryAi={() => setCategoryTrigger((n) => n + 1)}
          onDescriptionAi={() => setDescriptionTrigger((n) => n + 1)}
          onGeoAi={() => setGeoTrigger((n) => n + 1)}
          onIdentityFocus={() => {
            go('diagnosis', 'identity');
            document.getElementById('product-identity-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        />
      )}
      {nav === 'compete' ? <ComingSoonPanel title="竞争分析" /> : null}
      {nav === 'buyers' ? <ComingSoonPanel title="买家洞察" /> : null}
      {nav === 'monitor' ? <ComingSoonPanel title="监控中心" /> : null}
      {nav === 'history' ? <ComingSoonPanel title="历史记录" /> : null}
    </AppShell>
  );
}
