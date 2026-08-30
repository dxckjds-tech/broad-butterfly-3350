import type { DiagnosisIssue } from '@trade-ai/shared-types';
import { IssueCard } from './IssueCard';

export function IssueList({
  issues,
  onTitleAi,
  onKeywordAi,
  onCategoryAi,
}: {
  issues: DiagnosisIssue[];
  onTitleAi?: () => void;
  onKeywordAi?: () => void;
  onCategoryAi?: () => void;
}) {
  const critical = issues.filter((item) => item.severity === 'CRITICAL').length;
  const important = issues.filter((item) => item.severity === 'HIGH').length;
  const advice = issues.filter((item) => item.severity === 'MEDIUM' || item.severity === 'LOW').length;

  return (
    <section>
      <div className="issue-summary">
        <h2>发现 {issues.length} 个问题</h2>
        <p>
          严重问题 {critical}　重要问题 {important}　建议优化 {advice}
        </p>
      </div>
      <div className="issue-list">
        {issues.map((issue) => (
          <IssueCard
            key={issue.id}
            issue={issue}
            onAiGenerate={
              issue.id.startsWith('mic-title')
                ? onTitleAi
                : issue.id === 'google-keyword-count' || issue.id.startsWith('mic-primary-keyword')
                  ? onKeywordAi
                  : issue.id === 'mic-category-relevance'
                    ? onCategoryAi
                    : undefined
            }
          />
        ))}
      </div>
    </section>
  );
}
