import { createLlmProvider, loadAiConfig, optimizeTitle, clearAiCache } from '../index';

const SAMPLE = {
  productName: 'High Suction Heavy Duty Wet and Dry Vacuum Cleaner for Industrial Use',
  category: 'Steam Cleaner',
  keywords: ['wet and dry vacuum cleaner', 'industrial vacuum cleaner', 'workshop vacuum'],
  centerTerms: ['vacuum cleaner'],
  specifications: {
    Application: 'Industrial workshop',
    Type: 'Wet and Dry Vacuum Cleaner',
    Suction: 'High suction',
  },
  description:
    'High suction heavy duty wet and dry vacuum cleaner for industrial use. Suitable for workshop cleaning of dust and liquid.',
  certifications: [] as string[],
          url: 'https://membercenter.made-in-china.com/product/title-pilot',
  identityUserVerified: true,
};

async function main(): Promise<void> {
  clearAiCache();
  const config = loadAiConfig();
  const provider = createLlmProvider(config);
  const result = await optimizeTitle({
    provider,
    config,
    input: SAMPLE,
    skipCache: true,
  });
  const report = {
    provider: result.meta.provider,
    requestedProvider: config.requestedProvider,
    fallbackReason: config.fallbackReason ?? null,
    model: result.meta.model,
    latency: result.meta.latency,
    tokenUsage: { inputTokens: result.meta.inputTokens, outputTokens: result.meta.outputTokens },
    originalTitle: result.originalTitle,
    coreProductTerm: result.coreProductTerm,
    problems: result.problems,
    recommendedTitles: result.recommendedTitles,
    keywordSuggestions: result.keywordSuggestions,
    factGuard: result.factGuard,
    promptVersion: result.meta.promptVersion,
    engineVersion: result.meta.engineVersion,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (result.meta.provider !== 'deepseek') {
    process.exitCode = 2;
  }
}

void main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
