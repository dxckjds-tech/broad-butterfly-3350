import type { FieldStatus, ParseQuality, PlatformPageData } from '@trade-ai/shared-types';
import { fieldLabel } from '@trade-ai/platform-adapters';

function statusText(status: FieldStatus | undefined, extra?: string): string {
  if (status === 'FOUND') return extra ? `已识别${extra}` : '已识别';
  if (status === 'UNCERTAIN') return extra ? `未确定${extra}` : '未成功识别';
  return extra ? `未识别${extra}` : '未识别';
}

export function ParseStatus({ page }: { page: PlatformPageData }) {
  const quality: ParseQuality | undefined = page.parseQuality;
  const status = page.fieldStatus ?? {};
  const uncertain = Object.values(status).some((item) => item === 'UNCERTAIN') || (quality?.score ?? 100) < 45;

  return (
    <section className="parse-status">
      <h3>页面识别完成</h3>
      <ul>
        <li>标题：{statusText(status.productName)}</li>
        <li>公司：{statusText(status.companyName)}</li>
        <li>图片：{page.images.length} 张</li>
        <li>规格：{Object.keys(page.specifications).length} 项</li>
        <li>MOQ：{statusText(status.moq)}</li>
      </ul>
      {quality ? (
        <p className="parse-status__score">
          解析完整度 {quality.score} / 100
          {quality.missingFields.length
            ? ` · 待补：${quality.missingFields.slice(0, 4).map(fieldLabel).join('、')}`
            : ''}
        </p>
      ) : null}
      {uncertain ? (
        <p className="parse-status__warn">部分字段未成功识别，当前诊断结果可能不完整。</p>
      ) : null}
      {page.parseDebug ? (
        <pre className="parse-status__debug">{JSON.stringify(page.parseDebug, null, 2)}</pre>
      ) : null}
    </section>
  );
}
