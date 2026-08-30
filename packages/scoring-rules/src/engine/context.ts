import type { FieldStatus, PlatformPageData, ProductTypeProfile } from '@trade-ai/shared-types';
import { PARSE_QUALITY_LOW, PARSE_QUALITY_UNCERTAIN } from '../config';
import { companyEvidenceScore } from './company';
import { attributeCount, detectCoreProductTerm } from './core-term';
import { evidenceCount } from './evidence-count';
import { imageStats } from './images';
import { detectProductTypeProfile, isCustomizationRelevant } from './product-type';
import { specificationStats } from './specs';
import {
  APPLICATION_PATTERNS,
  FAQ_PATTERNS,
  marketingPhraseHits,
  meaningfulTextRatio,
  sectionCount,
  wordCount,
} from './text';

export interface RuleContext {
  page: PlatformPageData;
  parseScore: number;
  parseLow: boolean;
  parseUncertain: boolean;
  blob: string;
  profile: ProductTypeProfile;
  customRelevant: boolean;
  coreProductTerm: string | null;
  distinctProductTerms: string[];
  titleWords: number;
  attributes: number;
  specTotal: number;
  meaningfulSpecificationCount: number;
  weakOnlySpecs: boolean;
  uniqueImageCount: number;
  mainImageCount: number;
  detailImageCount: number;
  duplicateImageRatio: number;
  companyScore: number;
  evidence: number;
  sectionCount: number;
  descWords: number;
  fluffHits: number;
  meaningfulRatio: number;
  hasApplication: boolean;
  hasFaq: boolean;
  field: (key: string) => FieldStatus | undefined;
}

export function buildRuleContext(page: PlatformPageData): RuleContext {
  const blob = `${page.title} ${page.productName} ${page.description} ${page.rawText} ${page.companyName}`.toLowerCase();
  const parseScore = page.parseQuality?.score ?? 100;
  const core = detectCoreProductTerm(page);
  const spec = specificationStats(page);
  const images = imageStats(page);
  const profile = detectProductTypeProfile(page);

  return {
    page,
    parseScore,
    parseLow: parseScore < PARSE_QUALITY_LOW,
    parseUncertain: parseScore < PARSE_QUALITY_UNCERTAIN,
    blob,
    profile,
    customRelevant: isCustomizationRelevant(profile),
    coreProductTerm: core.coreProductTerm,
    distinctProductTerms: core.distinctProductTerms,
    titleWords: wordCount(page.productName || page.title || ''),
    attributes: attributeCount(page.productName || ''),
    specTotal: spec.total,
    meaningfulSpecificationCount: spec.meaningfulSpecificationCount,
    weakOnlySpecs: spec.weakOnly,
    uniqueImageCount: images.uniqueCount,
    mainImageCount: images.mainImageCount,
    detailImageCount: images.detailImageCount,
    duplicateImageRatio: images.duplicateImageRatio,
    companyScore: companyEvidenceScore(`${page.companyName} ${page.description} ${page.rawText}`),
    evidence: evidenceCount(page, blob),
    sectionCount: sectionCount(`${page.description} ${page.rawText}`),
    descWords: wordCount(page.description || ''),
    fluffHits: marketingPhraseHits(`${page.productName} ${page.description} ${page.rawText}`),
    meaningfulRatio: meaningfulTextRatio(page.description || ''),
    hasApplication: APPLICATION_PATTERNS.test(`${page.description} ${page.rawText}`),
    hasFaq: FAQ_PATTERNS.test(`${page.description} ${page.rawText}`),
    field: (key) => page.fieldStatus?.[key as keyof NonNullable<PlatformPageData['fieldStatus']>],
  };
}
