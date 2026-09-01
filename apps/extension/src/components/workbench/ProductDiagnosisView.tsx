import { inspectProductIdentity } from '@trade-ai/scoring-rules';
import type { DiagnosisResult, PlatformPageData, ReasoningState } from '@trade-ai/shared-types';
import {
  resolveTrustedIdentity,
  titleRecommendationsPaused,
} from '@trade-ai/universal-product-intelligence';
import { KeywordOptimizePanel } from '../KeywordOptimizePanel';
import { ScoreCard } from '../ScoreCard';
import { TitleOptimizePanel } from '../TitleOptimizePanel';
import { IdentityConfirmBar } from './IdentityConfirmBar';

function specValue(specs: Record<string, string>, pattern: RegExp): string {
  const entry = Object.entries(specs).find(([key]) => pattern.test(key));
  return entry?.[1]?.trim() ?? '';
}

function evidenceScore(count: number): number {
  if (count <= 0) return 0;
  return Math.min(96, 58 + count * 8);
}

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: '已确认',
  LIKELY: '较可能',
  UNCERTAIN: '不确定',
  CONFLICT: '冲突',
};

export function ProductDiagnosisView({
  page,
  reasoning,
  result,
  titleTrigger,
  keywordTrigger,
  requireConfirm,
  onVerified,
}: {
  page: PlatformPageData;
  reasoning: ReasoningState | null;
  result: DiagnosisResult | null;
  titleTrigger: number;
  keywordTrigger: number;
  requireConfirm: boolean;
  onVerified: (verified: boolean) => void;
}) {
  const identity = inspectProductIdentity(page);
  const trusted = reasoning ? resolveTrustedIdentity(page, reasoning) : identity.profile.coreProduct;
  const paused = reasoning
    ? titleRecommendationsPaused(page, reasoning, identity.keywordRecommendationsPaused)
    : identity.keywordRecommendationsPaused && !page.identityUserVerified;
  const mismatch = reasoning?.conflicts.find((c) => c.code === 'IDENTITY_MISMATCH') ?? identity.conflict;
  const specs = page.specifications ?? {};
  const model = specValue(specs, /^(model|型号|item no|sku)$/i);
  const brand = specValue(specs, /^(brand|品牌)$/i);
  const confidence = reasoning
    ? Math.round(reasoning.confidence.score * 100)
    : Math.round(identity.profile.identityConfidence * 100);
  const status = reasoning ? STATUS_LABEL[reasoning.status] ?? reasoning.status : mismatch ? '冲突' : '识别中';

  const tags: string[] = [];
  const capacity = specValue(specs, /capacity|tank|volume|容量/i);
  const power = specValue(specs, /^(power|watt|功率)$/i);
  const suction = specValue(specs, /suction|吸力/i);
  const material = specValue(specs, /material|材质/i);
  const fn = specValue(specs, /function|功能/i);
  if (capacity) tags.push(`${capacity} 容量`);
  if (power) tags.push(`${power} 功率`);
  if (suction) tags.push(`${suction} 吸力`);
  if (fn) tags.push(fn);
  if (material) tags.push(material);

  const verifiedCerts =
    reasoning?.productProfile.certifications.filter((c) => c.status === 'VERIFIED').map((c) => c.value) ??
    (page.certifications ?? []);
  const images = page.images?.length ? page.images : [];
  const verifiedAttrs = reasoning?.productProfile.dynamicAttributes.filter((a) => a.status === 'VERIFIED') ?? [];

  const evidenceCards = [
    {
      label: '商品图片证据',
      detail: images.length ? `${images.length} 张已采集` : '未采集图片',
      score: evidenceScore(images.length),
      tone: images.length ? 'ok' : 'muted',
    },
    {
      label: '商品参数证据',
      detail: Object.keys(specs).length ? `${Object.keys(specs).length} 项规格` : '无规格',
      score: evidenceScore(Object.keys(specs).length),
      tone: Object.keys(specs).length ? 'ok' : 'muted',
    },
    {
      label: '商品描述证据',
      detail: page.description?.trim() ? '描述仅作观察，不能验证认证' : '无描述',
      score: page.description?.trim() ? 62 : 0,
      tone: 'warn',
    },
    {
      label: '商品类目证据',
      detail: page.category || '未识别分组',
      score: page.category ? 88 : 0,
      tone: page.category ? 'ok' : 'muted',
    },
    {
      label: '认证证据',
      detail: verifiedCerts.length ? verifiedCerts.join(' / ') : '无认证字段，描述中的 CE/CB/ETL/RoHS 未验证',
      score: verifiedCerts.length ? 90 : 12,
      tone: verifiedCerts.length ? 'ok' : 'muted',
    },
    {
      label: '冲突证据',
      detail: mismatch ? `原标题「${page.productName || page.title}」与可信身份不一致` : '未发现身份硬冲突',
      score: mismatch ? 85 : 20,
      tone: mismatch ? 'danger' : 'ok',
    },
  ];

  return (
    <div className="wb">
      {result ? (
        <div className="score-grid wb-scores">
          <ScoreCard label="综合" value={result.totalScore} />
          <ScoreCard label="MIC SEO" value={result.scores.micSeo} />
          <ScoreCard label="Google SEO" value={result.scores.googleSeo} />
          <ScoreCard label="GEO" value={result.scores.geo} />
          <ScoreCard label="内容" value={result.scores.contentQuality} />
        </div>
      ) : null}
      <div className="wb-cols">
        <div className="wb-main">
          <section className="wb-card wb-id">
            <div className="wb-id__head">
              <div>
                <p className="eyebrow">商品识别结果 · UPI {status}</p>
                <h2>{trusted}</h2>
                <p className="wb-id__meta">
                  {model ? <span>型号 {model}</span> : null}
                  {brand ? <span>品牌 {brand}</span> : null}
                  {page.category ? <span>商品分组 {page.category}</span> : null}
                  {page.identityUserVerified ? <span>已人工确认</span> : null}
                </p>
              </div>
              <span className={confidence >= 70 && !mismatch ? 'wb-badge wb-badge--ok' : 'wb-badge wb-badge--warn'}>
                置信度 {confidence}%
              </span>
            </div>
            <div className="wb-id__visual">
              {images[0] ? <img src={images[0]} alt={trusted} /> : <div className="wb-id__ph">未采集主图</div>}
              {images.length > 1 ? (
                <div className="wb-thumbs">
                  {images.slice(0, 4).map((src) => (
                    <img key={src} src={src} alt="" />
                  ))}
                </div>
              ) : null}
            </div>
            {tags.length || verifiedAttrs.length ? (
              <div className="wb-tags">
                {tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
                {verifiedAttrs.map((attr) => (
                  <span key={`${attr.name}-${attr.value}`}>{attr.name}</span>
                ))}
              </div>
            ) : (
              <p className="eyebrow">无已验证规格标签。容量/功率/吸力只来自参数字段。</p>
            )}
          </section>

          {mismatch || paused ? (
            <section className="wb-alert">
              <h3>发现标题与实际商品不一致</h3>
              <p>
                <strong>原标题</strong> {page.productName || page.title}
              </p>
              <p>
                标题中的产品身份与商品分组「{page.category || trusted}」冲突。确认前暂停标题和关键词生成，且不得从旧标题/描述写入认证声明。
              </p>
              <IdentityConfirmBar page={page} onVerified={onVerified} />
            </section>
          ) : (
            <section className="wb-card">
              <h3>产品身份</h3>
              <p className="eyebrow">标题、分组与规格指向同一产品。DRY_RUN，确认后 AI 不得覆盖身份。</p>
              <IdentityConfirmBar page={page} onVerified={onVerified} />
            </section>
          )}

          <section className="wb-card">
            <h3>证据概览</h3>
            <div className="wb-evidence">
              {evidenceCards.map((card) => (
                <article key={card.label} className={`wb-ev wb-ev--${card.tone}`}>
                  <strong>{card.label}</strong>
                  <p>{card.detail}</p>
                  <span style={{ width: `${card.score}%` }} />
                  <em>{card.score}%</em>
                </article>
              ))}
            </div>
          </section>

          <section className="wb-card">
            <h3>商品属性抽取</h3>
            {Object.keys(specs).length ? (
              <table className="wb-table">
                <tbody>
                  {Object.entries(specs).map(([key, value]) => (
                    <tr key={key}>
                      <th>{key}</th>
                      <td>{value}</td>
                    </tr>
                  ))}
                  <tr>
                    <th>认证（字段已验证）</th>
                    <td>{verifiedCerts.length ? verifiedCerts.join(' / ') : '无。描述中的证书不得写入标题。'}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="eyebrow">当前页没有可抽取的规格字段。</p>
            )}
          </section>
        </div>

        <aside className="wb-side">
          <TitleOptimizePanel
            page={page}
            trigger={titleTrigger}
            requireConfirm={requireConfirm}
            layout="plans"
            showKeywordSuggestions={false}
          />
          <KeywordOptimizePanel page={page} trigger={keywordTrigger} requireConfirm={requireConfirm} layout="workbench" />

          <section className="wb-card">
            <h3>风险检测</h3>
            <ul className="wb-risk">
              <li className={mismatch ? 'wb-risk--bad' : 'wb-risk--ok'}>
                {mismatch ? '原标题产品身份冲突 · 严重' : '产品错配 · 无'}
              </li>
              <li className="wb-risk--ok">虚假属性 · 认证仅接受认证字段</li>
              <li className="wb-risk--ok">关键词堆砌 · 生成前已门禁</li>
              <li className="wb-risk--ok">正式 Top3 · 无真实搜索证据则保持为空</li>
            </ul>
          </section>

          <section className="wb-card">
            <h3>优化建议</h3>
            <ul className="wb-tips">
              {mismatch ? <li>将旧标题中的冲突产品词改为可信身份「{trusted}」。</li> : null}
              {capacity || power || suction ? (
                <li>仅在规格已验证时突出 {[capacity, suction, power].filter(Boolean).join('、')}。</li>
              ) : (
                <li>不要从描述补写容量、功率或认证。</li>
              )}
              {(reasoning?.nextActions ?? [])
                .filter((a) => !a.done)
                .slice(0, 4)
                .map((a) => (
                  <li key={a.id}>{a.summary}</li>
                ))}
              {(result?.issues ?? []).slice(0, 3).map((issue) => (
                <li key={issue.id}>{issue.suggestion}</li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
