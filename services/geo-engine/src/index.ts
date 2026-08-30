import type { PlatformPageData } from '@trade-ai/shared-types';

export interface GeoCheck {
  id:
    | 'company-entity'
    | 'product-entity'
    | 'specifications'
    | 'applications'
    | 'faq'
    | 'evidence'
    | 'certifications'
    | 'manufacturer-information'
    | 'oem-capability'
    | 'buyer-intent-questions'
    | 'ai-citation-quality';
  label: string;
  present: boolean;
  note: string;
}

export interface GeoAnalysisResult {
  checks: GeoCheck[];
  summary: string;
}

export interface GeoAnalyzer {
  analyze(pageData: PlatformPageData): Promise<GeoAnalysisResult>;
}

function present(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object' && value) return Object.keys(value).length > 0;
  return String(value ?? '').trim().length > 0;
}

export class StubGeoAnalyzer implements GeoAnalyzer {
  async analyze(pageData: PlatformPageData): Promise<GeoAnalysisResult> {
    const blob = `${pageData.description} ${pageData.rawText}`.toLowerCase();
    const checks: GeoCheck[] = [
      {
        id: 'company-entity',
        label: 'Company Entity',
        present: present(pageData.companyName),
        note: pageData.companyName || 'missing',
      },
      {
        id: 'product-entity',
        label: 'Product Entity',
        present: present(pageData.productName),
        note: pageData.productName || 'missing',
      },
      {
        id: 'specifications',
        label: 'Specifications',
        present: present(pageData.specifications),
        note: `${Object.keys(pageData.specifications).length} specs`,
      },
      {
        id: 'applications',
        label: 'Applications',
        present: /application|used for|场景|用于/.test(blob),
        note: 'Phase 1 heuristic',
      },
      {
        id: 'faq',
        label: 'FAQ',
        present: /faq|frequently asked|常见问题/.test(blob),
        note: 'Phase 1 heuristic',
      },
      {
        id: 'evidence',
        label: 'Evidence',
        present: pageData.images.length >= 3,
        note: `${pageData.images.length} images`,
      },
      {
        id: 'certifications',
        label: 'Certifications',
        present: present(pageData.certifications),
        note: pageData.certifications.join(', ') || 'none',
      },
      {
        id: 'manufacturer-information',
        label: 'Manufacturer Information',
        present: present(pageData.companyName),
        note: 'uses company name in Phase 1',
      },
      {
        id: 'oem-capability',
        label: 'OEM Capability',
        present: pageData.oemAvailable,
        note: pageData.oemAvailable ? 'detected' : 'not detected',
      },
      {
        id: 'buyer-intent-questions',
        label: 'Buyer Intent Questions',
        present: /faq|moq|lead time|sample/.test(blob),
        note: 'Phase 1 heuristic',
      },
      {
        id: 'ai-citation-quality',
        label: 'AI Citation Quality',
        present: false,
        note: 'Reserved — not evaluated in Phase 1',
      },
    ];

    const hit = checks.filter((item) => item.present).length;
    return {
      checks,
      summary: `GEO stub: ${hit}/${checks.length} signals present for ${pageData.url}`,
    };
  }
}

export const geoAnalyzer: GeoAnalyzer = new StubGeoAnalyzer();
