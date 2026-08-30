import type { FieldStatus, ParseQuality, PlatformPageData } from '@trade-ai/shared-types';
import { fieldLabel } from '@trade-ai/platform-adapters';

function statusText(status: FieldStatus | undefined, extra?: string): string {
  if (status === 'FOUND') return extra ? `已识别${extra}` : '已识别';
  if (status === 'UNCERTAIN') return extra ? `未确定${extra}` : '未成功识别';
  return extra ? `未识别${extra}` : '未识别';
}

function sourceLabel(page: PlatformPageData): string {
  const sources = Object.values(page.fieldEvidence ?? {});
  if (sources.includes('BACKEND_FORM')) return '后台表单';
  if (page.diagnosisMode === 'BACKEND_EDIT') return '后台可见文本';
  if (sources.includes('PUBLIC_PAGE')) return '公开产品页';
  return '页面解析';
}

export function ParseStatus({ page }: { page: PlatformPageData }) {
  const quality: ParseQuality | undefined = page.parseQuality;
  const status = page.fieldStatus ?? {};
  const readiness = page.dataReadiness;
  const lowReady = (readiness?.score ?? quality?.score ?? 100) < 70;
  const debug =
    String((import.meta as { env?: { VITE_PARSER_DEBUG?: string; PARSER_DEBUG?: string } }).env?.VITE_PARSER_DEBUG).toLowerCase() ===
      'true' ||
    String((import.meta as { env?: { PARSER_DEBUG?: string } }).env?.PARSER_DEBUG).toLowerCase() === 'true';

  return (
    <section className="parse-status">
      <h3>页面识别完成</h3>
      {page.pageType === 'MIC_PRODUCT_EDIT' ? (
        <p className="parse-status__score">
          类目：{page.category || '—'} · 解析 {quality?.score ?? 0}% · 数据源：{sourceLabel(page)}
        </p>
      ) : null}
      <ul>
        <li>标题：{statusText(status.productName)}</li>
        <li>公司：{statusText(status.companyName)}</li>
        <li>图片：{page.images.length} 张{status.images === 'UNCERTAIN' ? '（区域未完整加载）' : ''}</li>
        <li>
          规格：{Object.keys(page.specifications).length} 项
          {page.specDebug ? `（有效 ${page.specDebug.meaningfulSpecificationCount}）` : ''}
        </li>
        <li>关键词：{page.keywords.length}{status.keywords === 'UNCERTAIN' ? '（未确定）' : ''}</li>
        <li>中心词：{page.centerTerms?.length ?? 0}</li>
        <li>MOQ：{statusText(status.moq)}</li>
        <li>OEM：{statusText(status.oemAvailable)}</li>
      </ul>
      {readiness ? (
        <div className="parse-status__ready">
          <strong>Data Readiness {readiness.score}%</strong>
          <ul>
            {readiness.items.map((item) => (
              <li key={item.key}>
                {item.ok ? '✓' : '△'} {item.label}
                {item.detail ? ` ${item.detail}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {quality ? (
        <p className="parse-status__score">
          解析完整度 {quality.score} / 100
          {quality.missingFields.length
            ? ` · 待补：${quality.missingFields.slice(0, 4).map(fieldLabel).join('、')}`
            : ''}
        </p>
      ) : null}
      {lowReady ? (
        <p className="parse-status__warn">当前编辑页面部分模块尚未加载，本次诊断可能不完整。</p>
      ) : null}
      {debug && page.parseDebug ? (
        <pre className="parse-status__debug">{JSON.stringify(page.parseDebug, null, 2)}</pre>
      ) : null}
      {debug && page.specDebug ? (
        <pre className="parse-status__debug">{JSON.stringify({ specDebug: page.specDebug, sections: page.sectionAvailability }, null, 2)}</pre>
      ) : null}
    </section>
  );
}
