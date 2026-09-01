import { detectCoreProductTerm } from '@trade-ai/scoring-rules';
import { emptyPageData } from '@trade-ai/shared-types';
import type { PlatformPageData } from '@trade-ai/shared-types';
import type { AiRuntimeConfig } from '../config';
import type {
  GenerateStructuredInput,
  GenerateStructuredResult,
  GenerateTextInput,
  GenerateTextResult,
  HealthCheckResult,
  LLMProvider,
  LlmAnalyzeResult,
} from '../provider';

export class MockLLMProvider implements LLMProvider {
  readonly name: string = 'mock';

  constructor(private readonly config?: AiRuntimeConfig) {}

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    return {
      text: `[mock:${this.name}] ${input.prompt.slice(0, 80)}`,
      model: 'mock',
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }

  async generateStructured(input: GenerateStructuredInput): Promise<GenerateStructuredResult> {
    const trusted = this.extractField(input.prompt, 'trustedIdentity');
    const title = trusted || this.extractField(input.prompt, 'productName') || this.extractField(input.prompt, 'staleSellerTitle') || 'Product';
    const current = this.extractList(input.prompt, 'currentKeywords');
    const page = emptyPageData({
      productName: title,
      title,
      platform: 'MADE_IN_CHINA',
      pageType: 'MIC_PRODUCT_EDIT',
    });
    const detected = detectCoreProductTerm(page).coreProductTerm;
    const core =
      this.extractField(input.prompt, 'trustedIdentity') ||
      (/\bvacuum cleaner\b/i.test(title) ? 'vacuum cleaner' : detected || 'product');

    if (input.schemaName === 'KeywordOptimizeOutput') {
      const mic = [
        { keyword: `industrial ${core}`, priority: 'HIGH' as const, reason: 'Lead with product noun and use case.' },
        { keyword: `heavy duty ${core}`, priority: 'HIGH' as const, reason: 'Matches listed duty rating.' },
        { keyword: `wet dry ${core}`, priority: 'HIGH' as const, reason: 'Keeps wet/dry capability from the title.' },
        { keyword: 'workshop vacuum', priority: 'MEDIUM' as const, reason: 'Application phrase for buyers.' },
        { keyword: 'high suction vacuum', priority: 'MEDIUM' as const, reason: 'Uses the listed suction fact.' },
      ];
      const data = {
        currentKeywords: current,
        problems: ['Mock provider: no live LLM key', 'Keywords may overlap the title'],
        primaryKeywords: [{ keyword: `industrial ${core}`, reason: 'Core product phrase.', usedFacts: [title], warnings: [] }],
        secondaryKeywords: [{ keyword: 'high suction vacuum', reason: 'Attribute phrase.', usedFacts: ['high suction'], warnings: [] }],
        buyerIntentKeywords: [{ keyword: `heavy duty ${core}`, reason: 'Buyer search phrase.', usedFacts: ['heavy duty'], warnings: [] }],
        applicationKeywords: [{ keyword: 'workshop vacuum', reason: 'Scene phrase.', usedFacts: ['industrial'], warnings: [] }],
        micKeywords: mic,
      };
      return {
        data,
        raw: JSON.stringify(data),
        model: 'mock',
        usage: { inputTokens: 0, outputTokens: 0 },
        repaired: false,
      };
    }

    if (input.schemaName === 'DescriptionOptimizeOutput') {
      const original = this.extractField(input.prompt, 'description');
      const specs = this.extractSpecs(input.prompt);
      const specBody = specs.length
        ? `Key specifications from the listing:\n${specs.map(([k, v]) => `${k}: ${v}`).join('\n')}`
        : `Listed attributes for this ${core} include high suction and industrial use from the product name.`;
      const overview =
        `This ${core} is a heavy duty wet and dry vacuum cleaner for industrial use. ` +
        `It is intended for workshop cleaning of dust and liquid, using high suction as stated in the listing.`;
      const applications =
        `Suitable for industrial workshop cleaning. Use this ${core} where the listing mentions industrial or workshop environments and wet and dry pickup.`;
      const sections = [
        { heading: 'OVERVIEW' as const, title: 'Product Overview', body: overview },
        { heading: 'SPECIFICATIONS' as const, title: 'Key Specifications', body: specBody },
        { heading: 'APPLICATIONS' as const, title: 'Applications', body: applications },
      ];
      const data = {
        originalDescription: original,
        problems: original
          ? ['Description is short', 'Marketing fluff', 'Missing structured sections']
          : ['No product description on the form', 'Missing structured sections'],
        sections,
        recommendedDescription: sections.map((s) => `## ${s.title}\n${s.body}`).join('\n\n'),
      };
      return {
        data,
        raw: JSON.stringify(data),
        model: 'mock',
        usage: { inputTokens: 0, outputTokens: 0 },
        repaired: false,
      };
    }

    if (input.schemaName === 'GeoAnalysisOutput') {
      const company = this.extractField(input.prompt, 'companyName');
      const specs = this.extractSpecs(input.prompt);
      const description = this.extractField(input.prompt, 'description');
      const certs = this.extractList(input.prompt, 'certifications');
      const specMap = Object.fromEntries(specs);
      const power = specMap.Power || specMap.power;
      const application = specMap.Application || specMap.application;
      const type = specMap.Type || specMap.type;
      const suction = specMap.Suction || specMap.suction;
      const hasSpecs = specs.length > 0;
      const hasCompany = Boolean(company);
      const hasFaq = /faq|frequently asked|常见问题/i.test(description);
      const looksVacuum = /vacuum|wet and dry|wet\/dry/.test(title.toLowerCase()) || /\bvacuum\b/i.test(core);
      const verdict =
        looksVacuum && hasSpecs && hasCompany && hasFaq
          ? ('PARTIAL' as const)
          : looksVacuum && hasSpecs
            ? ('PARTIAL' as const)
            : hasSpecs
              ? ('PARTIAL' as const)
              : ('WEAK' as const);
      const productEntity = looksVacuum ? 'Wet and Dry Vacuum Cleaner' : title.slice(0, 80);
      const specNote = hasSpecs
        ? `Listing states ${specs.map(([k, v]) => `${k} ${v}`).join(', ')}.`
        : 'No specification fields were provided.';
      const data = {
        productEntity,
        companyEntity: company,
        verdict,
        score: verdict === 'PARTIAL' ? 0.42 : 0.24,
        summary: hasCompany
          ? `${productEntity} has a named company (${company}) and listed specs, but FAQ, OEM, and certifications are thin, so AI citation is only partial.`
          : `${productEntity} has listed product facts, but company entity, FAQ, and OEM are missing, so GEO visibility is weak.`,
        gaps: [
          {
            dimension: 'PRODUCT_ENTITY',
            status: looksVacuum || title ? 'PRESENT' : 'MISSING',
            note: title ? `Product name is ${title}.` : 'No product name.',
          },
          {
            dimension: 'COMPANY_ENTITY',
            status: hasCompany ? 'WEAK' : 'MISSING',
            note: hasCompany ? `Only the company name is present: ${company}.` : 'No company name on the listing.',
          },
          {
            dimension: 'SPECIFICATIONS',
            status: hasSpecs ? 'PRESENT' : 'MISSING',
            note: specNote,
          },
          {
            dimension: 'APPLICATIONS',
            status: application ? 'WEAK' : 'MISSING',
            note: application ? `Application field: ${application}.` : 'No application scene is listed.',
          },
          {
            dimension: 'FAQ',
            status: hasFaq ? 'PRESENT' : 'MISSING',
            note: hasFaq ? 'FAQ-like text is present in the description.' : 'No FAQ structure on the listing.',
          },
          {
            dimension: 'EVIDENCE',
            status: hasSpecs ? 'WEAK' : 'MISSING',
            note: hasSpecs ? 'Specs are present; other verifiable factory facts are not.' : 'Few verifiable facts.',
          },
          {
            dimension: 'CERTIFICATIONS',
            status: certs.length ? 'PRESENT' : 'MISSING',
            note: certs.length ? `Listed: ${certs.join(', ')}.` : 'The listing does not state certifications.',
          },
          {
            dimension: 'OEM',
            status: 'MISSING',
            note: 'The listing does not state OEM or customization capability.',
          },
          {
            dimension: 'BUYER_INTENT',
            status: 'MISSING',
            note: 'MOQ, lead time, and sample policy are not stated.',
          },
        ],
        recommendations: [
          {
            title: 'Name the product type in the description',
            body: `Open the description with the product type from the title: ${title}. Keep industrial wet and dry use if those words already appear.`,
          },
          {
            title: 'Add a short applications sentence',
            body: application
              ? `State the listed application in one sentence: ${application}. Do not add industries that are not on the form.`
              : 'Add an Applications sentence only if a scene is already in the title or specs.',
          },
          {
            title: 'Publish FAQ from listed facts',
            body: 'Add 3–5 FAQ answers using title and spec fields only. If MOQ, lead time, or certifications are blank, the answer must say the listing does not state them.',
          },
        ],
        faqSuggestions: [
          {
            question: 'What type of vacuum cleaner is this?',
            answer: type
              ? `The listing type is ${type}.`
              : `The listing title describes ${title}.`,
          },
          {
            question: 'What power and suction are listed?',
            answer:
              power || suction
                ? `The listing states${power ? ` power ${power}` : ''}${power && suction ? ' and' : ''}${suction ? ` suction ${suction}` : ''}.`
                : 'The listing does not state power or suction.',
          },
          {
            question: 'Where is this vacuum intended to be used?',
            answer: application
              ? `The listing application is ${application}.`
              : 'The listing does not state a detailed application scene beyond the product name.',
          },
          {
            question: 'Does the listing include certifications or OEM capability?',
            answer: 'The listing does not state certifications or OEM capability.',
          },
        ],
      };
      return {
        data,
        raw: JSON.stringify(data),
        model: 'mock',
        usage: { inputTokens: 0, outputTokens: 0 },
        repaired: false,
      };
    }

    if (input.schemaName === 'CategoryCheckOutput') {
      const category = this.extractField(input.prompt, 'category');
      const looksVacuum =
        /vacuum|wet and dry|wet\/dry/.test(title.toLowerCase()) || /\bvacuum\b/i.test(core);
      const looksSteamCat = /steam/.test(category.toLowerCase());
      const usedFacts = [title, category].filter(Boolean);

      if (!category.trim()) {
        const data = {
          currentCategory: '（未识别类目）',
          verdict: 'UNCERTAIN' as const,
          confidence: 0.2,
          reason: '当前类目为空，无法判断是否与产品匹配。',
          suggestedCategoryConcept: looksVacuum ? 'Wet and Dry Vacuum Cleaner' : title.slice(0, 80),
          usedFacts,
        };
        return {
          data,
          raw: JSON.stringify(data),
          model: 'mock',
          usage: { inputTokens: 0, outputTokens: 0 },
          repaired: false,
        };
      }

      if (looksVacuum && looksSteamCat) {
        const data = {
          currentCategory: category,
          verdict: 'POSSIBLE_MISMATCH' as const,
          confidence: 0.86,
          reason:
            '标题和关键词更接近 Wet and Dry Vacuum Cleaner，而不是 Steam Cleaner。当前类目偏向蒸汽清洁，与湿干吸尘产品事实不一致。',
          suggestedCategoryConcept: 'Wet and Dry Vacuum Cleaner',
          usedFacts,
        };
        return {
          data,
          raw: JSON.stringify(data),
          model: 'mock',
          usage: { inputTokens: 0, outputTokens: 0 },
          repaired: false,
        };
      }

      const data = {
        currentCategory: category,
        verdict: 'MATCH' as const,
        confidence: 0.72,
        reason: `当前类目 ${category} 与标题 ${title} 方向基本一致。`,
        suggestedCategoryConcept: category,
        usedFacts,
      };
      return {
        data,
        raw: JSON.stringify(data),
        model: 'mock',
        usage: { inputTokens: 0, outputTokens: 0 },
        repaired: false,
      };
    }

    const specMap = Object.fromEntries(this.extractSpecs(input.prompt));
    const model = specMap.Model || specMap['型号'] || specMap.model || '';
    const head = [trusted || core, model].filter(Boolean).join(' ');
    const data = {
      originalTitle: this.extractField(input.prompt, 'staleSellerTitle') || title,
      coreProductTerm: trusted || core,
      problems: ['Mock provider: no live LLM key', 'Title may lack buyer-intent phrasing'],
      recommendedTitles: [
        {
          style: 'SEO_BALANCED',
          title: head.slice(0, 120),
          reason: 'Keep the trusted identity and a readable English order.',
          usedFacts: [trusted || core, model].filter(Boolean),
          warnings: ['Generated by MockProvider'],
        },
        {
          style: 'BUYER_INTENT',
          title: head.slice(0, 120),
          reason: 'Lead with the trusted product noun buyers search.',
          usedFacts: [trusted || core, model].filter(Boolean),
          warnings: ['Generated by MockProvider'],
        },
        {
          style: 'GEO_FRIENDLY',
          title: head.slice(0, 120),
          reason: 'Short entity-clear title for AI citation.',
          usedFacts: [trusted || core, model].filter(Boolean),
          warnings: ['Generated by MockProvider'],
        },
      ],
      keywordSuggestions: [trusted || core].filter(Boolean).slice(0, 3),
    };
    return {
      data,
      raw: JSON.stringify(data),
      model: 'mock',
      usage: { inputTokens: 0, outputTokens: 0 },
      repaired: false,
    };
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return {
      ok: true,
      provider: 'mock',
      model: 'mock',
      latencyMs: 0,
      status: 'mock',
      error: this.config?.fallbackReason,
    };
  }

  async analyze(pageData: PlatformPageData): Promise<LlmAnalyzeResult> {
    return {
      summary: `Mock analysis for ${pageData.productName || pageData.title || 'unknown page'}. Provider=${this.name}.`,
      suggestions: [
        'Clarify the product focus keyword in the title.',
        'Add structured specifications and OEM capability.',
        'Publish FAQ and application scenarios for GEO.',
      ],
    };
  }

  private extractField(prompt: string, field: string): string {
    const m = prompt.match(new RegExp(`${field}:\\s*(.+)`));
    return m?.[1]?.trim() && m[1] !== '(none)' ? m[1].trim() : '';
  }

  private extractList(prompt: string, field: string): string[] {
    const raw = this.extractField(prompt, field);
    if (!raw) return [];
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }

  private extractSpecs(prompt: string): Array<[string, string]> {
    const block = prompt.split('specifications:')[1]?.split(/verifiedCertifications:|description:/)[0] ?? '';
    const rows: Array<[string, string]> = [];
    for (const line of block.split('\n')) {
      const m = line.match(/^\s*([^:]{1,40}):\s*(.+)$/);
      if (!m?.[1] || !m[2] || m[2].trim() === '(none)') continue;
      rows.push([m[1].trim(), m[2].trim()]);
    }
    return rows;
  }
}
