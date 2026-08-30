import { z } from 'zod';

export const DescriptionSectionHeadingSchema = z.enum([
  'OVERVIEW',
  'SPECIFICATIONS',
  'APPLICATIONS',
  'CUSTOMIZATION',
  'PACKING',
]);

export const DESCRIPTION_SECTION_TITLES: Record<z.infer<typeof DescriptionSectionHeadingSchema>, string> = {
  OVERVIEW: 'Product Overview',
  SPECIFICATIONS: 'Key Specifications',
  APPLICATIONS: 'Applications',
  CUSTOMIZATION: 'Customization',
  PACKING: 'Packing and Delivery',
};

export const DescriptionSectionSchema = z.object({
  heading: DescriptionSectionHeadingSchema,
  title: z.string().min(3).max(80),
  body: z.string().min(20).max(1500),
});

export const DescriptionOptimizeOutputSchema = z.object({
  originalDescription: z.string().max(8000).default(''),
  problems: z.array(z.string()).max(12).default([]),
  sections: z.array(DescriptionSectionSchema).min(3).max(5),
  recommendedDescription: z.string().min(60).max(5000),
});

export type DescriptionOptimizeOutput = z.infer<typeof DescriptionOptimizeOutputSchema>;

export const DESCRIPTION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['originalDescription', 'problems', 'sections', 'recommendedDescription'],
  properties: {
    originalDescription: { type: 'string' },
    problems: { type: 'array', items: { type: 'string' } },
    recommendedDescription: { type: 'string' },
    sections: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['heading', 'title', 'body'],
        properties: {
          heading: {
            type: 'string',
            enum: ['OVERVIEW', 'SPECIFICATIONS', 'APPLICATIONS', 'CUSTOMIZATION', 'PACKING'],
          },
          title: { type: 'string' },
          body: { type: 'string' },
        },
      },
    },
  },
} as const;

const HEADING_ALIASES: Record<string, z.infer<typeof DescriptionSectionHeadingSchema>> = {
  OVERVIEW: 'OVERVIEW',
  PRODUCT_OVERVIEW: 'OVERVIEW',
  DESCRIPTION: 'OVERVIEW',
  SPECIFICATIONS: 'SPECIFICATIONS',
  SPECIFICATION: 'SPECIFICATIONS',
  KEY_SPECIFICATIONS: 'SPECIFICATIONS',
  SPECS: 'SPECIFICATIONS',
  APPLICATIONS: 'APPLICATIONS',
  APPLICATION: 'APPLICATIONS',
  CUSTOMIZATION: 'CUSTOMIZATION',
  OEM: 'CUSTOMIZATION',
  PACKING: 'PACKING',
  PACKAGING: 'PACKING',
  DELIVERY: 'PACKING',
};

export function assembleDescription(
  sections: Array<{ title: string; body: string }>,
): string {
  return sections
    .map((s) => `## ${s.title.trim()}\n${s.body.trim()}`)
    .join('\n\n')
    .trim();
}

export function coerceDescriptionOutput(data: unknown, originalDescription: string): unknown {
  if (!data || typeof data !== 'object') return data;
  const rec = { ...(data as Record<string, unknown>) };
  if (typeof rec.originalDescription !== 'string') rec.originalDescription = originalDescription;
  if (!Array.isArray(rec.problems)) rec.problems = [];
  const rawSections = Array.isArray(rec.sections) ? rec.sections : [];
  const seen = new Set<string>();
  const sections: Array<Record<string, unknown>> = [];
  for (const item of rawSections) {
    if (!item || typeof item !== 'object') continue;
    const row = { ...(item as Record<string, unknown>) };
    const key = String(row.heading || row.title || '')
      .toUpperCase()
      .replace(/[^A-Z]+/g, '_');
    const heading = HEADING_ALIASES[key];
    if (!heading || seen.has(heading)) continue;
    seen.add(heading);
    row.heading = heading;
    row.title = DESCRIPTION_SECTION_TITLES[heading];
    row.body = typeof row.body === 'string' ? row.body.trim().slice(0, 1500) : '';
    if (String(row.body).length < 20) continue;
    sections.push(row);
  }
  rec.sections = sections.slice(0, 5);
  if (typeof rec.recommendedDescription !== 'string' || rec.recommendedDescription.trim().length < 60) {
    rec.recommendedDescription = assembleDescription(
      sections.map((s) => ({ title: String(s.title), body: String(s.body) })),
    );
  } else {
    rec.recommendedDescription = rec.recommendedDescription.trim().slice(0, 5000);
  }
  return rec;
}
