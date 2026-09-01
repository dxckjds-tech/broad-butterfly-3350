import type { AiRuntimeConfig } from './config';
import type { AiTaskType } from './provider';

const FAST_TASKS = new Set<AiTaskType>([
  'TITLE_OPTIMIZATION',
  'KEYWORD_OPTIMIZATION',
  'DESCRIPTION_OPTIMIZATION',
  'FAQ_GENERATION',
  'BUYER_INTENT',
]);

const PRO_TASKS = new Set<AiTaskType>([
  'CATEGORY_CHECK',
  'GEO_DEEP_ANALYSIS',
  'DEEP_DIAGNOSIS',
  'OPERATIONS_PLANNER',
]);

export interface RoutedModel {
  taskType: AiTaskType;
  tier: 'fast' | 'pro';
  model: string;
}

export function routeModel(taskType: AiTaskType, config: AiRuntimeConfig): RoutedModel {
  const tier: 'fast' | 'pro' = PRO_TASKS.has(taskType) ? 'pro' : FAST_TASKS.has(taskType) ? 'fast' : 'fast';
  if (config.provider === 'openai' || config.requestedProvider === 'openai') {
    return { taskType, tier, model: config.openai.model };
  }
  return {
    taskType,
    tier,
    model: tier === 'pro' ? config.deepseek.proModel : config.deepseek.fastModel,
  };
}
