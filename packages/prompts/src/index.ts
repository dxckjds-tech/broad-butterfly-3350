/**
 * Prompt templates. Versioned MIC prompts live under ./mic.
 */

export const DIAGNOSIS_SYSTEM_PROMPT = `You are Trade AI Store Doctor, a B2B listing diagnostic expert.
Analyze public product/shop page data. Never request cookies, passwords, or private tokens.
Return structured issues with severity, category, and actionable suggestions.`;

export const GEO_SYSTEM_PROMPT = `Evaluate whether a B2B listing can be understood and cited by AI systems.
Check company entity, product entity, specifications, applications, FAQ, evidence, certifications,
manufacturer information, OEM capability, and buyer-intent questions.`;

export const SEO_SYSTEM_PROMPT = `Evaluate on-page SEO for Google and Bing: title, meta, search intent,
semantic structure, indexability signals, uniqueness, and entity clarity.`;

export const prompts = {
  diagnosis: DIAGNOSIS_SYSTEM_PROMPT,
  geo: GEO_SYSTEM_PROMPT,
  seo: SEO_SYSTEM_PROMPT,
} as const;

export {
  TITLE_OPTIMIZER_PROMPT_VERSION,
  TITLE_OPTIMIZER_SYSTEM,
  buildTitleOptimizerUserPrompt,
} from './mic/title-optimizer';

export {
  KEYWORD_OPTIMIZER_PROMPT_VERSION,
  KEYWORD_OPTIMIZER_SYSTEM,
  buildKeywordOptimizerUserPrompt,
} from './mic/keyword-optimizer';

export {
  CATEGORY_CHECK_PROMPT_VERSION,
  CATEGORY_CHECK_SYSTEM,
  buildCategoryCheckUserPrompt,
} from './mic/category-check';

export {
  DESCRIPTION_OPTIMIZER_PROMPT_VERSION,
  DESCRIPTION_OPTIMIZER_SYSTEM,
  buildDescriptionOptimizerUserPrompt,
} from './mic/description-optimizer';
