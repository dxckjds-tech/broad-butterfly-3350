import { createLlmProvider, loadAiConfig, optimizeKeywords, clearAiCache } from '../index';

const SAMPLE = {
  productName: 'High Suction Heavy Duty Wet and Dry Vacuum Cleaner for Industrial Use',
  category: 'Steam Cleaner',
  currentKeywords: [
    'Heavy Duty Cleaner',
    'Wet and Dry Cleaner',
    'Industrial Use Cleaner',
    'Powerful Industrial Vacuum Cleaner',
    'High Suction Vacuum Cleaner',
    'Industrial Vacuum Cleaner',
    'Wet Dry Vacuum',
    'Heavy Duty Vacuum Cleaner',
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
    'High suction heavy duty wet and dry vacuum cleaner for industrial use. Suitable for workshop cleaning of dust and liquid.',
  url: 'https://membercenter.made-in-china.com/product/keyword-pilot',
};

async function main(): Promise<void> {
  clearAiCache();
  const config = loadAiConfig();
  const provider = createLlmProvider(config);
  const result = await optimizeKeywords({
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
    currentKeywords: result.currentKeywords,
    problems: result.problems,
    primaryKeywords: result.primaryKeywords.map((k) => k.keyword),
    secondaryKeywords: result.secondaryKeywords.map((k) => k.keyword),
    buyerIntentKeywords: result.buyerIntentKeywords.map((k) => k.keyword),
    applicationKeywords: result.applicationKeywords.map((k) => k.keyword),
    micKeywords: result.micKeywords,
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
