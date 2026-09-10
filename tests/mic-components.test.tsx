/**
 * v0.3.0 Step 2 — MIC component library, templates, and schema → tree adapter.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '../src/editor/components'
import {
  MICCertification,
  MICCompanyProfile,
  MICFactoryGallery,
  MICFAQ,
  MICFeatureSection,
  MICPackaging,
  MICProductHero,
  MICSpecificationTable,
} from '../src/mic/components'
import { getComponent } from '../src/editor/core/registry'
import { parsePageDocument } from '../src/editor/core/schema'
import { canInsertNode } from '../src/editor/core/rules'
import {
  convertMICComponentTreeToBuilder,
  convertMICPageToBuilder,
  convertMICPageToComponentTree,
} from '../src/mic/adapters'
import { buildConsumerPage, buildElectronicsPage, buildMachineryPage } from '../src/mic/templates'
import { emptyMICPageSchema } from '../src/mic/schema'
import { MIC_COMPONENT_TYPES } from '../src/mic/components/types'

afterEach(() => {
  cleanup()
})

describe('all MIC components render', () => {
  it('renders every presentational component with typical props', () => {
    render(
      <>
        <MICProductHero
          title="Cordless Handheld Vacuum Cleaner"
          mainImage="https://cdn.example.com/vac-main.jpg"
          keywords={['vacuum', 'cordless']}
          highlights={['1.2 kg', '30 min runtime']}
        />
        <MICFeatureSection
          features={[{ title: 'Lightweight', description: '1.2 kg body', image: 'https://cdn.example.com/f.jpg' }]}
        />
        <MICSpecificationTable specifications={[{ name: 'Weight', value: '1.2kg' }]} />
        <MICCertification certifications={['CE', 'RoHS']} />
        <MICFactoryGallery images={[{ url: 'https://cdn.example.com/plant.jpg', type: 'factory' }]} />
        <MICPackaging description="Color box" shipping="FOB Ningbo" />
        <MICFAQ faq={[{ question: 'Is it cordless?', answer: 'Yes, 30 minutes.' }]} />
        <MICCompanyProfile name="Ningbo Example Co., Ltd." description="OEM factory." capacity="50,000" employees="200+" />
      </>,
    )
    expect(screen.getByTestId('mic-product-hero')).toBeTruthy()
    expect(screen.getByTestId('mic-feature-section')).toBeTruthy()
    expect(screen.getByTestId('mic-specification-table')).toBeTruthy()
    expect(screen.getByTestId('mic-certification')).toBeTruthy()
    expect(screen.getByTestId('mic-factory-gallery')).toBeTruthy()
    expect(screen.getByTestId('mic-packaging')).toBeTruthy()
    expect(screen.getByTestId('mic-faq')).toBeTruthy()
    expect(screen.getByTestId('mic-company-profile')).toBeTruthy()
    expect(screen.getByText('Cordless Handheld Vacuum Cleaner')).toBeTruthy()
    expect(screen.getByText('CE')).toBeTruthy()
  })

  it('registers all eight MIC types without changing registry.ts', () => {
    for (const type of MIC_COMPONENT_TYPES) {
      expect(getComponent(type)?.type).toBe(type)
      expect(getComponent(type)?.acceptsChildren).toBe(false)
    }
    expect(canInsertNode('section', 'mic-product-hero')).toBe(true)
    expect(canInsertNode('root', 'mic-product-hero')).toBe(false)
  })
})

describe('empty data does not throw', () => {
  it('renders placeholders and fallback copy when props are empty', () => {
    render(
      <>
        <MICProductHero title="" />
        <MICFeatureSection features={[]} />
        <MICSpecificationTable specifications={[]} />
        <MICCertification certifications={[]} />
        <MICFactoryGallery images={[]} />
        <MICPackaging description="" shipping="" />
        <MICFAQ faq={[]} />
        <MICCompanyProfile name="" description="" />
      </>,
    )
    expect(screen.getByText('No product image')).toBeTruthy()
    expect(screen.queryByText('vacuum')).toBeNull()
    expect(screen.getByText('No specifications available')).toBeTruthy()
    expect(screen.getByText('No features available')).toBeTruthy()
    expect(screen.getByText('No certifications listed')).toBeTruthy()
    expect(screen.getByText('No factory images')).toBeTruthy()
    expect(screen.getByText('No packaging information')).toBeTruthy()
    expect(screen.getByText('No frequently asked questions')).toBeTruthy()
    expect(screen.getByText('No company profile')).toBeTruthy()
  })

  it('converts an empty MIC page without throwing', () => {
    const tree = convertMICPageToComponentTree(emptyMICPageSchema())
    expect(tree.some((node) => node.type === 'mic-product-hero')).toBe(true)
    expect(tree.some((node) => node.type === 'mic-specification-table')).toBe(true)
    const page = convertMICComponentTreeToBuilder(tree)
    expect(page.root.type).toBe('root')
  })
})

describe('templates generate the expected component order', () => {
  it('builds the machinery template as Hero → Feature → Spec → Factory → Cert → Packaging → FAQ', () => {
    const tree = convertMICPageToComponentTree(buildMachineryPage())
    const types = tree.map((node) => node.type)
    expect(types.slice(0, 7)).toEqual([
      'mic-product-hero',
      'mic-feature-section',
      'mic-specification-table',
      'mic-factory-gallery',
      'mic-certification',
      'mic-packaging',
      'mic-faq',
    ])
    const features = tree.find((node) => node.type === 'mic-feature-section')
    const featureList = features?.props['features']
    expect(Array.isArray(featureList)).toBe(true)
    if (Array.isArray(featureList)) {
      expect(featureList.length).toBeGreaterThanOrEqual(1)
      expect(featureList.length).toBeLessThanOrEqual(6)
    }
    const gallery = tree.find((node) => node.type === 'mic-factory-gallery')
    const images = gallery?.props['images']
    expect(Array.isArray(images)).toBe(true)
    if (Array.isArray(images)) {
      expect(images.some((image) => isRecordWithType(image, 'factory'))).toBe(true)
      expect(images.some((image) => isRecordWithType(image, 'production'))).toBe(true)
      expect(images.some((image) => isRecordWithType(image, 'certificate'))).toBe(true)
    }
  })

  it('builds electronics and consumer templates with a hero title', () => {
    const electronics = convertMICPageToComponentTree(buildElectronicsPage())
    const consumer = convertMICPageToComponentTree(buildConsumerPage())
    expect(electronics[0]?.props['title']).toMatch(/LED Driver/)
    expect(consumer[0]?.props['title']).toMatch(/Vacuum/)
  })
})

describe('schema conversion', () => {
  it('maps MICPageSchema onto builder sections that parse under v0.2.1 schema', () => {
    const mic = buildConsumerPage()
    const tree = convertMICPageToComponentTree(mic)
    const page = convertMICPageToBuilder(mic)
    expect(page.root.children?.every((child) => child.type === 'section')).toBe(true)
    const types = (page.root.children ?? []).flatMap((section) =>
      (section.children ?? []).map((child) => child.type),
    )
    expect(types).toEqual(tree.map((node) => node.type))

    const parsed = parsePageDocument(JSON.parse(JSON.stringify(page)) as unknown)
    expect(parsed.ok).toBe(true)
  })

  it('hides keyword tags when the array is empty but keeps the title', () => {
    const empty = emptyMICPageSchema()
    const tree = convertMICPageToComponentTree({
      ...empty,
      product: { ...empty.product, productName: 'Bare listing', keywords: [] },
    })
    const hero = tree.find((node) => node.type === 'mic-product-hero')
    expect(hero?.props['title']).toBe('Bare listing')
    expect(hero?.props['keywords']).toEqual([])
  })
})

describe('FAQ default collapsed', () => {
  it('does not show answers until a question is opened', () => {
    render(
      <MICFAQ
        faq={[
          { question: 'Is it cordless?', answer: 'Yes, up to 30 minutes per charge.' },
          { question: 'Private label?', answer: 'Yes, MOQ 500 pcs.' },
        ]}
      />,
    )
    const first = screen.getByRole('button', { name: 'Is it cordless?' })
    expect(first.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('Yes, up to 30 minutes per charge.')).toBeNull()
    expect(screen.queryByText('Yes, MOQ 500 pcs.')).toBeNull()

    fireEvent.click(first)
    expect(first.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Yes, up to 30 minutes per charge.')).toBeTruthy()
    expect(screen.queryByText('Yes, MOQ 500 pcs.')).toBeNull()
  })
})

function isRecordWithType(value: unknown, type: string): boolean {
  return typeof value === 'object' && value !== null && 'type' in value && value.type === type
}
