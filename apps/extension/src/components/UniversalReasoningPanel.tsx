import type { ReasoningState } from '@trade-ai/shared-types';

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: '已确认',
  LIKELY: '较可能',
  UNCERTAIN: '不确定',
  CONFLICT: '冲突',
};

const FACT_STATUS: Record<string, string> = {
  VERIFIED: '已验证',
  INFERRED: '推断',
  OBSERVED: '已观察',
  UNKNOWN: '未知',
};

export function UniversalReasoningPanel({
  reasoning,
}: {
  reasoning: ReasoningState | null;
}) {
  if (!reasoning) return null;
  const profile = reasoning.productProfile;
  const status = STATUS_LABEL[reasoning.status] ?? reasoning.status;
  const interval = `${Math.round(reasoning.confidence.interval.low * 100)}%–${Math.round(reasoning.confidence.interval.high * 100)}%`;
  const showSteps = import.meta.env.DEV;

  return (
    <section className="ai-title ai-upi" id="universal-reasoning-panel">
      <div className="ai-title__head">
        <h3>商品识别（自适应）</h3>
        <span className={`ai-upi__status ai-upi__status--${reasoning.status.toLowerCase()}`}>{status}</span>
      </div>
      <p className="eyebrow">
        Universal Product Intelligence → 产品事实 → 关键词门禁。不展示内部推理过程。DRY_RUN，不写回 MIC。
      </p>
      <p>
        <strong>识别结果</strong> {profile.identity.label}
      </p>
      <p>
        <strong>置信区间</strong> {Math.round(reasoning.confidence.score * 100)}%（{interval}）
        <em className="ai-upi__formula"> {reasoning.confidence.formulaVersion}</em>
      </p>
      <p>
        <strong>Top 候选</strong>
      </p>
      <ol className="ai-upi__list">
        {profile.identity.candidates.map((row) => (
          <li key={row.id}>
            {row.label}
            <em>
              {Math.round(row.posterior * 100)}% · 支持 {row.supportingEvidence.length} · 反证{' '}
              {row.opposingEvidence.length}
            </em>
          </li>
        ))}
      </ol>
      {profile.categoryCandidates.length ? (
        <>
          <p>
            <strong>类目候选</strong>
          </p>
          <ol className="ai-upi__list">
            {profile.categoryCandidates.map((row) => (
              <li key={row.id}>
                {row.label}
                <em>{Math.round(row.posterior * 100)}%</em>
              </li>
            ))}
          </ol>
        </>
      ) : null}
      <p>
        <strong>判断依据</strong>
      </p>
      <ul className="ai-upi__list">
        {profile.evidence.slice(0, 8).map((ev) => (
          <li key={ev.id}>
            {ev.channel} · {ev.field}
            <em>{ev.excerpt.slice(0, 80)}</em>
          </li>
        ))}
      </ul>
      {reasoning.conflicts.length ? (
        <div className="ai-identity__conflict">
          <p>
            <strong>冲突</strong>
          </p>
          {reasoning.conflicts.map((c) => (
            <p key={c.id}>
              {c.code}：{c.summary}
            </p>
          ))}
        </div>
      ) : (
        <p className="eyebrow">未发现身份或材质硬冲突。</p>
      )}
      <p>
        <strong>未确认信息</strong>
      </p>
      <ul className="ai-upi__list">
        {reasoning.unknowns.map((u) => (
          <li key={u.id}>
            {u.slot}
            <em>{u.reason}</em>
          </li>
        ))}
      </ul>
      <p>
        <strong>动态属性</strong>
      </p>
      {profile.dynamicAttributes.length ? (
        <ul className="ai-upi__list">
          {profile.dynamicAttributes.map((attr) => (
            <li key={`${attr.name}-${attr.value}`}>
              {attr.name}: {attr.value}
              <em>
                {FACT_STATUS[attr.status] ?? attr.status}
                {attr.evidenceIds.length ? ` · ${attr.evidenceIds.join(',')}` : ''}
              </em>
            </li>
          ))}
        </ul>
      ) : (
        <p className="eyebrow">暂无已抽取属性。</p>
      )}
      <p>
        <strong>建议下一步</strong>
      </p>
      <ul className="ai-upi__list">
        {reasoning.nextActions
          .filter((a) => !a.done)
          .map((a) => (
            <li key={a.id}>{a.summary}</li>
          ))}
      </ul>
      <p className="eyebrow">
        正式 Top3 为空（{reasoning.seo.searchDemand}）。候选词仅待验证，SEO 不得回写产品事实。
        {reasoning.seo.autoApplyAllowed ? '' : ' 禁止一键覆盖标题/关键词。'}
      </p>
      {showSteps ? (
        <details className="ai-upi__dev">
          <summary>DEV_MODE 步骤摘要</summary>
          <ol>
            {reasoning.steps.map((step) => (
              <li key={`${step.phase}-${step.index}`}>
                {step.index}. {step.phase} — {step.summary}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </section>
  );
}
