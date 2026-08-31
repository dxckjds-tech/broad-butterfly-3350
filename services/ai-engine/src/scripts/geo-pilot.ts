import { analyzeGeo, clearAiCache, createLlmProvider, loadAiConfig } from '../index';

const SAMPLE = {
  productName: 'High Suction Heavy Duty Wet and Dry Vacuum Cleaner for Industrial Use',
  companyName: 'Demo Hardware Co., Ltd.',
  category: 'Steam Cleaner',
  keywords: [
    'Heavy Duty Cleaner',
    'Wet and Dry Cleaner',
    'Industrial Use Cleaner',
    'Powerful Industrial Vacuum Cleaner',
    'High Suction Vacuum Cleaner',
  ],
  currentKeywords: [
    'Heavy Duty Cleaner',
    'Wet and Dry Cleaner',
    'Industrial Use Cleaner',
    'Powerful Industrial Vacuum Cleaner',
    'High Suction Vacuum Cleaner',
  ],
  centerTerms: ['cleaner', 'suction'],
  specifications: {
    Application: 'Industrial workshop',
    Type: 'Wet and Dry Vacuum Cleaner',
    Suction: 'High suction',
    Power: '3000W',
    Material: 'Stainless Steel',
  },
  description:
    'High quality industrial cleaner. Best quality factory price. Welcome to inquiry our hot sale product for export.',
  url: 'https://membercenter.made-in-china.com/product/geo-pilot',
};

async function main(): Promise<void> {
  clearAiCache();
  const config = loadAiConfig();
  const provider = createLlmProvider(config);
  const result = await analyzeGeo({
    provider,
    config,
    input: SAMPLE,
    skipCache: true,
  });
  const report = {
    provider: result.meta.provider,
    model: result.meta.model,
    latency: result.meta.latency,
    tokenUsage: { inputTokens: result.meta.inputTokens, outputTokens: result.meta.outputTokens },
    productEntity: result.productEntity,
    companyEntity: result.companyEntity,
    verdict: result.verdict,
    score: result.score,
    summary: result.summary,
    gaps: result.gaps,
    recommendations: result.recommendations.map((r) => r.title),
    faqCount: result.faqSuggestions.length,
    faqSuggestions: result.faqSuggestions,
    factGuard: result.factGuard,
    promptVersion: result.meta.promptVersion,
    engineVersion: result.meta.engineVersion,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (result.meta.provider !== 'deepseek') process.exitCode = 2;
}

void main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
