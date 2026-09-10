/**
 * Pure conversion: `MICPageSchema` → MIC component tree → builder `PageDocument`.
 *
 * Does not dispatch, does not touch the Zustand store, and does not call AI.
 * MIC nodes are wrapped in `section` so v0.2.1 root nesting rules stay valid.
 */
import { createId } from '../../editor/core/ids'
import { ROOT_TYPE, SCHEMA_VERSION } from '../../editor/core/types'
import type { EditorNode, PageDocument } from '../../editor/core/types'
import type { MICPageSchema } from '../schema/page'
import type { FeatureItem, GalleryItem } from '../components/readProps'
import type { MicComponentNode } from '../components/types'

function section(child: EditorNode): EditorNode {
  return {
    id: createId('sec'),
    type: 'section',
    props: { contentWidth: 'boxed' },
    styles: {
      desktop: {
        paddingTop: '32px',
        paddingBottom: '32px',
        paddingLeft: '24px',
        paddingRight: '24px',
      },
    },
    children: [child],
  }
}

function micNode(type: MicComponentNode['type'], props: Record<string, unknown>): EditorNode {
  return {
    id: createId(type.slice(0, 12)),
    type,
    props,
    styles: { desktop: { width: '100%' } },
  }
}

function mainImageUrl(page: MICPageSchema): string | undefined {
  const images = [...page.product.images].sort((left, right) => left.order - right.order)
  const main = images.find((image) => image.type === 'main' && image.url.trim() !== '')
  const any = images.find((image) => image.url.trim() !== '')
  const url = (main ?? any)?.url
  return url && url.trim() !== '' ? url : undefined
}

function highlightsFrom(page: MICPageSchema): string[] {
  const fromSpecs = page.product.specifications
    .map((row) => {
      const name = row.name.trim()
      const value = row.value.trim()
      if (name !== '' && value !== '') return `${name}: ${value}`
      return name || value
    })
    .filter((entry) => entry.length > 0)
  if (fromSpecs.length > 0) return fromSpecs.slice(0, 4)
  return page.product.keywords.filter((entry) => entry.trim() !== '').slice(0, 4)
}

/**
 * Selling-point cards come from description paragraphs (one card per block),
 * not from the spec table, so the two sections do not duplicate.
 */
function featuresFrom(page: MICPageSchema): FeatureItem[] {
  const blocks = page.product.description
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .slice(0, 6)
  const featureImages = page.product.images
    .filter((image) => image.type === 'feature' && image.url.trim() !== '')
    .sort((left, right) => left.order - right.order)

  return blocks.map((block, index) => {
    const lines = block.split('\n')
    const title = lines[0] ?? ''
    const description = lines.slice(1).join('\n')
    const item: FeatureItem = { title, description }
    const image = featureImages[index]
    if (image) item.image = image.url
    return item
  })
}

function splitPackaging(packaging: string): { description: string; shipping: string } {
  const marker = '\nShipping: '
  const index = packaging.indexOf(marker)
  if (index === -1) return { description: packaging, shipping: '' }
  return {
    description: packaging.slice(0, index).trim(),
    shipping: packaging.slice(index + marker.length).trim(),
  }
}

function galleryFrom(page: MICPageSchema): GalleryItem[] {
  const fromProduct: GalleryItem[] = page.product.images
    .filter((image) => image.url.trim() !== '')
    .filter((image) => image.type === 'factory' || image.type === 'certificate' || image.type === 'application')
    .sort((left, right) => left.order - right.order)
    .map((image) => ({
      url: image.url,
      type:
        image.type === 'certificate' ? 'certificate' : image.type === 'application' ? 'production' : 'factory',
    }))

  const fromCompany: GalleryItem[] = page.company.factoryImages
    .filter((url) => url.trim() !== '')
    .map((url) => ({ url, type: 'factory' }))

  return [...fromProduct, ...fromCompany]
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (trimmed === '' || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out
}

/**
 * Project a MIC page onto an ordered list of MIC components.
 * Empty optional blocks are omitted; the spec table is always emitted so
 * missing parameters still render "No specifications available".
 */
export function convertMICPageToComponentTree(page: MICPageSchema): MicComponentNode[] {
  const tree: MicComponentNode[] = []
  const heroImage = mainImageUrl(page)
  const heroProps: Record<string, unknown> = {
    title: page.product.productName,
    keywords: page.product.keywords,
    highlights: highlightsFrom(page),
  }
  if (heroImage) heroProps['mainImage'] = heroImage
  tree.push({ type: 'mic-product-hero', props: heroProps })

  const features = featuresFrom(page)
  if (features.length > 0) tree.push({ type: 'mic-feature-section', props: { features } })

  tree.push({
    type: 'mic-specification-table',
    props: { specifications: page.product.specifications },
  })

  const gallery = galleryFrom(page)
  if (gallery.length > 0) tree.push({ type: 'mic-factory-gallery', props: { images: gallery } })

  const certs = uniqueStrings([...page.product.certifications, ...page.company.certifications])
  if (certs.length > 0) tree.push({ type: 'mic-certification', props: { certifications: certs } })

  const packaging = splitPackaging(page.product.packaging)
  if (packaging.description !== '' || packaging.shipping !== '') {
    tree.push({ type: 'mic-packaging', props: packaging })
  }

  if (page.product.faq.length > 0) tree.push({ type: 'mic-faq', props: { faq: page.product.faq } })

  const company = page.company
  if (company.name || company.description || company.capacity || company.employees) {
    const props: Record<string, unknown> = {
      name: company.name,
      description: company.description || page.product.companyProfile,
    }
    if (company.capacity) props['capacity'] = company.capacity
    if (company.employees) props['employees'] = company.employees
    tree.push({ type: 'mic-company-profile', props })
  }

  return tree
}

/** Wrap a MIC component tree as a page-builder document (sections + MIC nodes). */
export function convertMICComponentTreeToBuilder(
  tree: MicComponentNode[],
  meta: { id?: string; name?: string; updatedAt?: string } = {},
): PageDocument {
  const children = tree.map((node) => section(micNode(node.type, { ...node.props })))
  const name = meta.name ?? 'MIC product page'
  return {
    id: meta.id || createId('page'),
    name,
    schemaVersion: SCHEMA_VERSION,
    root: {
      id: 'root',
      type: ROOT_TYPE,
      props: {},
      styles: { desktop: { backgroundColor: '#ffffff', minHeight: '100%' } },
      children,
    },
    updatedAt: meta.updatedAt || new Date().toISOString(),
  }
}

/** `MICPageSchema` → builder document through the MIC component tree. */
export function convertMICPageToBuilder(page: MICPageSchema): PageDocument {
  const tree = convertMICPageToComponentTree(page)
  return convertMICComponentTreeToBuilder(tree, {
    id: page.product.id || undefined,
    name: page.product.productName || 'MIC product page',
    updatedAt: page.metadata.updatedAt || undefined,
  })
}
