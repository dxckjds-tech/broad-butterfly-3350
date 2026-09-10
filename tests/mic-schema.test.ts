/**
 * v0.3.0 Step 1 — MIC schema, AI Patch Protocol, and adapter coverage.
 *
 * These tests do not mount the editor. Canvas, history, and drag-drop stay
 * on the v0.2.1 paths.
 */
import { describe, expect, it } from 'vitest'
import {
  emptyMICPageSchema,
  emptyProductSchema,
  parseMICPageSchema,
  parseProductSchema,
} from '../src/mic/schema'
import type { MICPageSchema, ProductSchema } from '../src/mic/schema'
import {
  applyPatch,
  applySuggestion,
  approveSuggestion,
  createPatch,
  createSuggestion,
  parsePatch,
  validatePatch,
  validateSuggestion,
} from '../src/ai/protocol'
import type { Patch } from '../src/ai/protocol'
import { convertBuilderToMIC, convertMICToBuilder } from '../src/core/adapters'
import type { PageDocument } from '../src/editor/core/types'
import { SCHEMA_VERSION } from '../src/editor/core/types'

function fullProduct(): ProductSchema {
  return {
    id: 'prd_vacuum_001',
    productName: 'Vacuum Cleaner',
    category: 'Home Appliances',
    keywords: ['vacuum', 'handheld', 'cordless'],
    images: [
      {
        id: 'img_1',
        url: 'https://cdn.example.com/main.jpg',
        type: 'main',
        order: 0,
        source: 'PAGE',
      },
      {
        id: 'img_2',
        url: 'https://cdn.example.com/factory.jpg',
        type: 'factory',
        order: 1,
        source: 'USER',
      },
    ],
    description: 'A compact handheld vacuum for home use.',
    specifications: [
      { name: 'Voltage', value: '220V' },
      { name: 'Weight', value: '1.2kg' },
    ],
    certifications: ['CE', 'RoHS'],
    packaging: 'Color box + carton',
    faq: [{ question: 'Is it cordless?', answer: 'Yes, up to 30 minutes.' }],
    companyProfile: 'Established manufacturer in Ningbo.',
    sourceInfo: {
      url: 'https://www.made-in-china.com/product/vacuum.html',
      platform: 'MIC',
      externalId: 'MIC-123',
    },
  }
}

function fullPage(): MICPageSchema {
  return parseMICPageSchema({
    product: fullProduct(),
    company: {
      name: 'Ningbo Example Co., Ltd.',
      description: 'OEM vacuum manufacturer.',
      factoryImages: ['https://cdn.example.com/plant.jpg'],
      certifications: ['ISO9001'],
      capacity: '50,000 pcs/month',
      employees: '200+',
    },
    metadata: {
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      version: '0.3.0',
    },
  })
}

function builderPage(overrides?: Partial<PageDocument>): PageDocument {
  return {
    id: 'page-test',
    name: 'Untitled page',
    schemaVersion: SCHEMA_VERSION,
    updatedAt: '2026-01-01T00:00:00.000Z',
    root: {
      id: 'root',
      type: 'root',
      props: {},
      styles: {},
      children: [
        {
          id: 'heading-1',
          type: 'heading',
          props: { text: 'Vacuum Cleaner', level: 'h1' },
          styles: {},
        },
        {
          id: 'text-1',
          type: 'text',
          props: { text: 'A compact handheld vacuum for home use.' },
          styles: {},
        },
        {
          id: 'image-1',
          type: 'image',
          props: { src: 'https://cdn.example.com/main.jpg', alt: 'product' },
          styles: {},
        },
      ],
    },
    ...overrides,
  }
}

describe('complete product data', () => {
  it('round-trips a full MIC product page without dropping fields', () => {
    const parsed = parseMICPageSchema(JSON.parse(JSON.stringify(fullPage())) as unknown)
    expect(parsed.product.productName).toBe('Vacuum Cleaner')
    expect(parsed.product.keywords).toEqual(['vacuum', 'handheld', 'cordless'])
    expect(parsed.product.images).toHaveLength(2)
    expect(parsed.product.images[0]?.type).toBe('main')
    expect(parsed.product.specifications).toHaveLength(2)
    expect(parsed.product.faq[0]?.question).toBe('Is it cordless?')
    expect(parsed.company.name).toBe('Ningbo Example Co., Ltd.')
    expect(parsed.company.capacity).toBe('50,000 pcs/month')
    expect(parsed.metadata.version).toBe('0.3.0')
  })
})

describe('missing fields', () => {
  it('fills empty strings and empty arrays when the page omits product fields', () => {
    const parsed = parseProductSchema({})
    expect(parsed).toEqual(emptyProductSchema())
    expect(parsed.specifications).toEqual([])
    expect(parsed.faq).toEqual([])
    expect(parsed.keywords).toEqual([])
    expect(parsed.productName).toBe('')
  })

  it('parses a MIC page with no product or company keys', () => {
    const parsed = parseMICPageSchema({})
    expect(parsed.product).toEqual(emptyProductSchema())
    expect(parsed.company.name).toBe('')
    expect(parsed.company.factoryImages).toEqual([])
    expect(parsed.company.certifications).toEqual([])
  })

  it('survives null, undefined, and non-objects without throwing', () => {
    expect(parseProductSchema(null).id).toBe('')
    expect(parseProductSchema(undefined).images).toEqual([])
    expect(parseMICPageSchema('nope')).toEqual(emptyMICPageSchema())
  })
})

describe('empty image array', () => {
  it('keeps images as [] when the gallery is missing or empty', () => {
    expect(parseProductSchema({ productName: 'X' }).images).toEqual([])
    expect(parseProductSchema({ images: [] }).images).toEqual([])
    expect(parseProductSchema({ images: 'not-an-array' }).images).toEqual([])
  })

  it('maps a builder page with no image nodes to an empty gallery', () => {
    const mic = convertBuilderToMIC(
      builderPage({
        root: {
          id: 'root',
          type: 'root',
          props: {},
          styles: {},
          children: [
            {
              id: 'heading-1',
              type: 'heading',
              props: { text: 'No photos yet', level: 'h1' },
              styles: {},
            },
          ],
        },
      }),
    )
    expect(mic.product.images).toEqual([])
    expect(mic.product.productName).toBe('No photos yet')
  })
})

describe('AI Patch generation', () => {
  it('creates an UPDATE patch that requires confirmation', () => {
    const patch = createPatch({
      action: 'UPDATE',
      target: 'product.productName',
      oldValue: 'Vacuum Cleaner',
      newValue: 'Cordless Handheld Vacuum Cleaner',
      source: 'AI_GENERATED',
      confidence: 0.92,
    })
    expect(patch.action).toBe('UPDATE')
    expect(patch.target).toBe('product.productName')
    expect(patch.newValue).toBe('Cordless Handheld Vacuum Cleaner')
    expect(patch.source).toBe('AI_GENERATED')
    expect(patch.confidence).toBe(0.92)
    expect(patch.needConfirm).toBe(true)
    expect(patch.id).toMatch(/^patch_/)
  })

  it('forces needConfirm on AI patches even when the caller omits it', () => {
    const parsed = parsePatch({
      action: 'UPDATE',
      target: 'product.productName',
      newValue: 'Cordless Handheld Vacuum Cleaner',
      source: 'AI_GENERATED',
      confidence: 0.92,
    })
    expect(parsed.needConfirm).toBe(true)
  })

  it('refuses to apply an unconfirmed AI patch, then applies after confirm', () => {
    const patch = createPatch({
      action: 'UPDATE',
      target: 'product.productName',
      oldValue: 'Vacuum Cleaner',
      newValue: 'Cordless Handheld Vacuum Cleaner',
      source: 'AI_GENERATED',
      confidence: 0.92,
    })
    const blocked = applyPatch(fullPage(), patch)
    expect(blocked.ok).toBe(false)
    if (blocked.ok) return
    expect(blocked.error).toMatch(/confirmation/i)

    const applied = applyPatch(fullPage(), patch, { confirmed: true })
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    expect(applied.page.product.productName).toBe('Cordless Handheld Vacuum Cleaner')
  })

  it('does not apply a pending suggestion until it is approved', () => {
    const suggestion = createSuggestion({
      title: 'Improve product title',
      description: 'Use a more specific English name.',
      patches: [
        createPatch({
          action: 'UPDATE',
          target: 'product.productName',
          oldValue: 'Vacuum Cleaner',
          newValue: 'Cordless Handheld Vacuum Cleaner',
          source: 'AI_GENERATED',
          confidence: 0.92,
        }),
      ],
    })
    expect(suggestion.status).toBe('PENDING')
    const pending = applySuggestion(fullPage(), suggestion)
    expect(pending.ok).toBe(false)

    const approved = applySuggestion(fullPage(), approveSuggestion(suggestion))
    expect(approved.ok).toBe(true)
    if (!approved.ok) return
    expect(approved.page.product.productName).toBe('Cordless Handheld Vacuum Cleaner')
  })
})

describe('Patch validation', () => {
  it('passes a confirmed-ready AI title update', () => {
    const result = validatePatch(
      createPatch({
        action: 'UPDATE',
        target: 'product.productName',
        newValue: 'Cordless Handheld Vacuum Cleaner',
        source: 'AI_GENERATED',
        confidence: 0.92,
      }),
    )
    expect(result.status).toBe('PASS')
  })

  it('blocks AI-generated patches that skip needConfirm', () => {
    const tampered: Patch = {
      id: 'patch_tampered',
      action: 'UPDATE',
      target: 'product.productName',
      newValue: 'Cordless Handheld Vacuum Cleaner',
      source: 'AI_GENERATED',
      confidence: 0.92,
      needConfirm: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    const result = validatePatch(tampered)
    expect(result.status).toBe('BLOCKED')
    expect(result.messages.some((message) => /needConfirm/i.test(message))).toBe(true)
  })

  it('warns on EXTERNAL_REFERENCE patches', () => {
    const result = validatePatch(
      createPatch({
        action: 'UPDATE',
        target: 'product.productName',
        newValue: 'Imported title',
        source: 'EXTERNAL_REFERENCE',
        confidence: 0.4,
      }),
    )
    expect(result.status).toBe('WARNING')
  })

  it('warns on high-risk specification / certification edits that still need confirm', () => {
    const specs = validatePatch(
      createPatch({
        action: 'UPDATE',
        target: 'product.specifications',
        newValue: [{ name: 'Voltage', value: '110V' }],
        source: 'AI_GENERATED',
        confidence: 0.5,
      }),
    )
    expect(specs.status).toBe('WARNING')

    const certs = validatePatch(
      createPatch({
        action: 'INSERT',
        target: 'product.certifications',
        newValue: 'ISO14001',
        source: 'AI_GENERATED',
        confidence: 0.5,
      }),
    )
    expect(certs.status).toBe('WARNING')
  })

  it('blocks high-risk edits that try to skip confirmation', () => {
    const tampered: Patch = {
      id: 'patch_risk',
      action: 'UPDATE',
      target: 'product.certifications',
      newValue: ['CE'],
      source: 'USER',
      confidence: 1,
      needConfirm: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    expect(validatePatch(tampered).status).toBe('BLOCKED')
  })

  it('marks a high-risk suggestion as WARNING', () => {
    const suggestion = createSuggestion({
      title: 'Rewrite specifications',
      description: 'Replace the voltage table.',
      risk: 'HIGH',
      patches: [
        createPatch({
          action: 'UPDATE',
          target: 'product.specifications.0.value',
          oldValue: '220V',
          newValue: '110V',
          source: 'AI_GENERATED',
          confidence: 0.3,
        }),
      ],
    })
    const result = validateSuggestion(suggestion)
    expect(result.status).toBe('WARNING')
  })
})

describe('builder adapter (data only)', () => {
  it('converts a builder tree into a MIC page without inventing specs or FAQ', () => {
    const mic = convertBuilderToMIC(builderPage())
    expect(mic.product.productName).toBe('Vacuum Cleaner')
    expect(mic.product.description).toContain('compact handheld')
    expect(mic.product.images).toHaveLength(1)
    expect(mic.product.images[0]?.url).toBe('https://cdn.example.com/main.jpg')
    expect(mic.product.images[0]?.source).toBe('PAGE')
    expect(mic.product.specifications).toEqual([])
    expect(mic.product.faq).toEqual([])
  })

  it('converts a MIC page into builder nodes using existing component types', () => {
    const page = convertMICToBuilder(fullPage())
    expect(page.schemaVersion).toBe(SCHEMA_VERSION)
    expect(page.root.type).toBe('root')
    expect(page.name).toBe('Vacuum Cleaner')
    const types: string[] = []
    const walk = (node: PageDocument['root']): void => {
      types.push(node.type)
      for (const child of node.children ?? []) walk(child)
    }
    walk(page.root)
    expect(types).toContain('section')
    expect(types).toContain('heading')
    expect(types).toContain('image')
    expect(types).toContain('text')
  })
})
