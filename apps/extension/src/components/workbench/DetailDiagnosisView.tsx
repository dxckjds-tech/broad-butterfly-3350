import type { DiagnosisResult, PlatformPageData } from '@trade-ai/shared-types';
import { CategoryCheckPanel } from '../CategoryCheckPanel';
import { DescriptionOptimizePanel } from '../DescriptionOptimizePanel';
import { GeoAnalysisPanel } from '../GeoAnalysisPanel';
import { IssueList } from '../IssueList';
import { ScoreCard } from '../ScoreCard';
import { StatusBlock } from '../StatusBlock';

export function DetailDiagnosisView({
  page,
  result,
  error,
  categoryTrigger,
  descriptionTrigger,
  geoTrigger,
  onTitleAi,
  onKeywordAi,
  onCategoryAi,
  onDescriptionAi,
  onGeoAi,
  onIdentityFocus,
}: {
  page: PlatformPageData | null;
  result: DiagnosisResult | null;
  error?: string;
  categoryTrigger: number;
  descriptionTrigger: number;
  geoTrigger: number;
  onTitleAi: () => void;
  onKeywordAi: () => void;
  onCategoryAi: () => void;
  onDescriptionAi: () => void;
  onGeoAi: () => void;
  onIdentityFocus: () => void;
}) {
  return (
    <div className="wb">
      {result ? (
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
        </>
      ) : (
        <p className="eyebrow wb-pad">先诊断当前页面，再看类目、描述和 GEO 建议。</p>
      )}
      <div className="wb-cols">
        <div className="wb-main">
          <CategoryCheckPanel page={page} trigger={categoryTrigger} />
          <DescriptionOptimizePanel page={page} trigger={descriptionTrigger} />
        </div>
        <aside className="wb-side">
          <GeoAnalysisPanel page={page} trigger={geoTrigger} />
        </aside>
      </div>
      {result ? (
        <IssueList
          issues={result.issues}
          onTitleAi={onTitleAi}
          onKeywordAi={onKeywordAi}
          onCategoryAi={onCategoryAi}
          onDescriptionAi={onDescriptionAi}
          onGeoAi={onGeoAi}
          onIdentityFocus={onIdentityFocus}
        />
      ) : null}
    </div>
  );
}
