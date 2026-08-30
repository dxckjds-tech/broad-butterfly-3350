import type {
  CategoryScoreDetail,
  DiagnosisConfidence,
  DiagnosisIssue,
  DiagnosisScoreDetails,
  DiagnosisScores,
  DimensionBreakdown,
  IssueCategory,
  RuleResult,
} from '@trade-ai/shared-types';
import { SCORE_WEIGHTS } from '@trade-ai/shared-types';
import { PARSE_QUALITY_LOW } from '../config';
import type { RuleContext } from './context';

const PRIORITY_RANK = { P0: 0, P1: 1, P2: 2, P3: 3 };
const SEVERITY_RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function bucketScore(results: RuleResult[]): number | null {
  const applied = results.filter((r) => r.status !== 'SKIPPED');
  if (!applied.length) return null;
  const penalty = applied.reduce((sum, r) => {
    if (r.status === 'PASS') return sum;
    const mag = Math.abs(r.scoreImpact);
    return sum + (r.status === 'UNCERTAIN' ? mag * 0.35 : mag);
  }, 0);
  return clamp(100 - penalty);
}

function weighted(parts: Array<{ weight: number; score: number | null }>): number {
  const usable = parts.filter((p): p is { weight: number; score: number } => p.score !== null);
  const totalW = usable.reduce((s, p) => s + p.weight, 0) || 1;
  return clamp(usable.reduce((s, p) => s + (p.score * p.weight) / totalW, 0));
}

export function scoreFromRules(results: RuleResult[], ctx: RuleContext): {
  scores: DiagnosisScores;
  scoreDetails: DiagnosisScoreDetails;
  diagnosisConfidence: DiagnosisConfidence;
} {
  const byId = (id: string) => results.filter((r) => r.ruleId === id);

  const micTitle = bucketScore([
    ...byId('mic-title-exists'),
    ...byId('mic-title-word-count'),
    ...byId('mic-title-readability'),
    ...byId('mic-title-brand-noise'),
    ...byId('mic-title-symbol-overuse'),
    ...byId('mic-title-attribute-richness'),
  ]);
  const micTopic = bucketScore([
    ...byId('mic-title-core-term'),
    ...byId('mic-title-keyword-stuffing'),
    ...byId('mic-title-repetition'),
  ]);
  const micRel = bucketScore([...byId('content-description-exists'), ...byId('content-description-length'), ...byId('content-application-coverage')]);
  const micSpec = bucketScore(byId('content-specification-coverage'));
  const micCat = bucketScore([...byId('google-keyword-count'), ...byId('geo-company')]);
  const micOther = bucketScore([...byId('mic-title-symbol-overuse')]);

  const micSeo = weighted([
    { weight: 0.3, score: micTitle },
    { weight: 0.2, score: micTopic },
    { weight: 0.2, score: micRel },
    { weight: 0.1, score: micSpec },
    { weight: 0.1, score: micCat },
    { weight: 0.1, score: micOther },
  ]);

  const content = weighted([
    { weight: 0.25, score: bucketScore(byId('content-description-length')) },
    { weight: 0.2, score: bucketScore(byId('content-specification-coverage')) },
    { weight: 0.2, score: bucketScore(byId('content-images')) },
    { weight: 0.15, score: bucketScore(byId('content-marketing-fluff')) },
    { weight: 0.2, score: bucketScore(byId('content-company-coverage')) },
  ]);

  const conversion = weighted([
    { weight: 0.25, score: bucketScore(byId('conversion-moq')) },
    { weight: 0.25, score: bucketScore(byId('conversion-oem')) },
    { weight: 0.25, score: bucketScore(byId('conversion-application')) },
    { weight: 0.15, score: bucketScore(byId('conversion-company')) },
    { weight: 0.1, score: bucketScore(byId('conversion-faq')) },
  ]);

  const googleSeo = bucketScore(results.filter((r) => r.category === 'GOOGLE_SEO')) ?? 80;
  const geoRule = bucketScore(results.filter((r) => r.category === 'GEO')) ?? 70;

  const scores: DiagnosisScores = {
    micSeo,
    googleSeo,
    geo: geoRule,
    contentQuality: content,
    b2bConversion: conversion,
    compliance: null,
  };

  const scoreDetails: DiagnosisScoreDetails = {
    micSeo: {
      score: micSeo,
      confidence: 0.9,
      breakdown: {
        titleQuality: micTitle ?? undefined,
        topicClarity: micTopic ?? undefined,
        contentRelevance: micRel ?? undefined,
        specificationQuality: micSpec ?? undefined,
        categoryEntity: micCat ?? undefined,
        other: micOther ?? undefined,
      } satisfies DimensionBreakdown,
    },
    googleSeo: { score: googleSeo, confidence: 0.55, breakdown: { keywordCoverage: googleSeo } },
    geo: { score: geoRule, confidence: 0.63, breakdown: { entityClarity: geoRule, evidenceDensity: ctx.evidence * 12 } },
    contentQuality: {
      score: content,
      confidence: 0.85,
      breakdown: {
        descriptionQuality: bucketScore(byId('content-description-length')) ?? undefined,
        specificationQuality: micSpec ?? undefined,
        imageQuality: bucketScore(byId('content-images')) ?? undefined,
        evidenceDensity: ctx.evidence * 12,
      },
    },
    b2bConversion: {
      score: conversion,
      confidence: 0.8,
      breakdown: {
        inquiryReadiness: conversion,
        customization: bucketScore(byId('conversion-oem')) ?? undefined,
      },
    },
  };

  const failish = results.filter((r) => r.status === 'FAIL' || r.status === 'UNCERTAIN');
  const avgConf =
    failish.length === 0
      ? 0.9
      : failish.reduce((s, r) => s + r.confidence, 0) / failish.length;
  let confScore = clamp(ctx.parseScore * 0.55 + avgConf * 100 * 0.35 + 10);
  if (ctx.parseLow) confScore = clamp(confScore * 0.7);
  const level = ctx.parseLow || confScore < 55 ? 'LOW' : confScore >= 80 ? 'HIGH' : 'MEDIUM';
  if (ctx.parseScore < PARSE_QUALITY_LOW && level !== 'LOW') {
    /* keep LOW */
  }

  return {
    scores,
    scoreDetails,
    diagnosisConfidence: { score: confScore, level: ctx.parseLow ? 'LOW' : level },
  };
}

export function totalScore(scores: DiagnosisScores): number {
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        scores.micSeo * SCORE_WEIGHTS.micSeo +
          scores.googleSeo * SCORE_WEIGHTS.googleSeo +
          scores.geo * SCORE_WEIGHTS.geo +
          scores.contentQuality * SCORE_WEIGHTS.contentQuality +
          scores.b2bConversion * SCORE_WEIGHTS.b2bConversion,
      ),
    ),
  );
}

export function resultsToIssues(results: RuleResult[]): DiagnosisIssue[] {
  return results
    .filter((r) => r.status === 'FAIL' || r.status === 'UNCERTAIN')
    .map((r) => ({
      id: r.ruleId,
      category: r.category as IssueCategory,
      severity: r.severity,
      title: r.title,
      description: r.description,
      suggestion: r.suggestion,
      scoreImpact: Math.abs(r.scoreImpact),
      evidence: r.evidence,
      priority: r.priority,
      suggestionType: r.suggestionType,
      relatedRuleIds: r.relatedRuleIds,
      confidence: r.confidence,
      fieldSource: r.fieldSource,
      status: r.status,
    }));
}

const TITLE_CLUSTER = ['mic-title-word-count', 'mic-title-attribute-richness', 'mic-title-readability'];
const STUFF_CLUSTER = ['mic-title-keyword-stuffing', 'mic-title-repetition', 'mic-title-core-term'];
const DESC_CLUSTER = ['content-description-exists', 'content-description-length'];

function clusterKey(id: string): string | null {
  if (TITLE_CLUSTER.includes(id)) return 'title-info';
  if (STUFF_CLUSTER.includes(id)) return 'title-stuffing';
  if (DESC_CLUSTER.includes(id)) return 'description';
  return null;
}

export function dedupeIssues(issues: DiagnosisIssue[]): DiagnosisIssue[] {
  const groups = new Map<string, DiagnosisIssue[]>();
  const rest: DiagnosisIssue[] = [];
  for (const issue of issues) {
    const key = clusterKey(issue.id);
    if (!key) {
      rest.push(issue);
      continue;
    }
    const list = groups.get(key) ?? [];
    list.push(issue);
    groups.set(key, list);
  }
  const merged: DiagnosisIssue[] = [];
  for (const [key, list] of groups) {
    if (list.length === 1) {
      merged.push(list[0]!);
      continue;
    }
    const sorted = sortIssues(list);
    const primary = sorted[0]!;
    merged.push({
      ...primary,
      collapsedTitle: key === 'title-info' ? '标题信息不足' : key === 'title-stuffing' ? '标题中心词不清晰' : '描述信息不足',
      title: key === 'title-info' ? '标题信息不足' : primary.title,
      description: sorted.map((i) => i.title).join('；'),
      relatedRuleIds: sorted.map((i) => i.id),
    });
  }
  return sortIssues([...merged, ...rest]);
}

export function sortIssues(issues: DiagnosisIssue[]): DiagnosisIssue[] {
  return [...issues].sort((a, b) => {
    const p = PRIORITY_RANK[a.priority ?? 'P2'] - PRIORITY_RANK[b.priority ?? 'P2'];
    if (p) return p;
    const s = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (s) return s;
    const i = Math.abs(b.scoreImpact) - Math.abs(a.scoreImpact);
    if (i) return i;
    return (b.confidence ?? 0) - (a.confidence ?? 0);
  });
}
