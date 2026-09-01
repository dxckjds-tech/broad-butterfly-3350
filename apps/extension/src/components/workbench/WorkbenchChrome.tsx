import { AiStatusBar } from '../AiStatusBar';
import { MicSyncBar } from '../MicSyncBar';
import type { PlatformPageData } from '@trade-ai/shared-types';
import { pageTypeLabel, platformLabel } from '../../utils/labels';

export function WorkbenchChrome({
  page,
  connected,
  diagnosing,
  onRefresh,
  onDiagnose,
}: {
  page: PlatformPageData | null;
  connected: boolean;
  diagnosing: boolean;
  onRefresh: () => void;
  onDiagnose: () => void;
}) {
  const parse = page?.parseQuality?.score;
  const ready = page?.dataReadiness?.score;
  return (
    <header className="wb-chrome">
      <div className="wb-chrome__meta">
        <span className={connected ? 'wb-dot wb-dot--ok' : 'wb-dot'}>{connected ? '已连接当前页面' : '未识别当前页面'}</span>
        {page ? (
          <span>
            {platformLabel(page.platform)} · {pageTypeLabel(page.pageType)}
          </span>
        ) : null}
        {typeof parse === 'number' ? <span>解析 {parse}%</span> : null}
        {typeof ready === 'number' ? <span>数据就绪 {ready}%</span> : null}
        {page?.category ? <span>分组 {page.category}</span> : null}
      </div>
      <div className="wb-chrome__actions">
        <button type="button" className="ghost" onClick={onRefresh}>
          刷新页面
        </button>
        <button type="button" className="primary app-toolbar__run" disabled={!page || diagnosing} onClick={onDiagnose}>
          {diagnosing ? '诊断中…' : '开始诊断'}
        </button>
      </div>
      <details className="wb-chrome__setup">
        <summary>连接 API / MIC 同步</summary>
        <AiStatusBar />
        <MicSyncBar pageUrl={page?.url} />
      </details>
    </header>
  );
}
