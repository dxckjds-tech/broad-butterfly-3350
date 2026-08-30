import type { DiagnosisIssue, IssueSeverity } from '@trade-ai/shared-types';
import { severityLabel } from '../utils/labels';

const TONE: Record<IssueSeverity, string> = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

export function IssueCard({ issue }: { issue: DiagnosisIssue }) {
  return (
    <article className={`issue issue--${TONE[issue.severity]}`}>
      <div className="issue__meta">
        <span className="issue__badge">{severityLabel(issue.severity)}</span>
        <span className="issue__impact">-{issue.scoreImpact}</span>
      </div>
      <h3>{issue.title}</h3>
      <p>{issue.description}</p>
      <p className="issue__suggest">
        <strong>优化建议：</strong>
        {issue.suggestion}
      </p>
      <div className="issue__actions">
        <button type="button" disabled>
          AI生成
        </button>
        <button type="button" disabled>
          复制建议
        </button>
        <button type="button" disabled>
          查看详情
        </button>
      </div>
    </article>
  );
}
