/**
 * Data-only bridge between the v0.2.1 page-builder tree and `MICPageSchema`.
 *
 * v0.3.0 Step 1: convert in memory only. This module does not dispatch
 * commands, does not touch the Zustand store, and does not change canvas,
 * layers, history, or drag-and-drop.
 *
 * Mapping is heuristic — the builder has no MIC field types yet — so a
 * round-trip can drop data the tree cannot express (keywords, FAQ rows,
 * certification lists, image roles, …). Missing MIC fields become empty
 * strings / empty arrays rather than throwing.
 */
import { createId } from '../../editor/core/ids'
import { ROOT_TYPE, SCHEMA_VERSION } from '../../editor/core/types'
import type { EditorNode, PageDocument, ResponsiveStyles } from '../../editor/core/types'
import { createMICPageSchema } from '../../mic/schema/page'
import type { MICPageSchema } from '../../mic/schema/page'
import { parseImageSchema } from '../../mic/schema/image'
import type { ImageSchema } from '../../mic/schema/image'
import { asString } from '../../mic/schema/coerce'

function walk(node: EditorNode, visit: (node: EditorNode) => void): void {
  visit(node)
  for (const child of node.children ?? []) walk(child, visit)
}

function readStringProp(node: EditorNode, key: string): string {
  return asString(node.props[key])
}

function collectByType(root: EditorNode, type: string): EditorNode[] {
  const matches: EditorNode[] = []
  walk(root, (node) => {
    if (node.type === type) matches.push(node)
  })
  return matches
}

/**
 * Project a builder `PageDocument` onto `MICPageSchema`.
 *
 * - `productName` ← first heading text, else the page name
 * - `description` ← text nodes, joined
 * - `images` ← image nodes (`type: "unknown"`, `source: "PAGE"`)
 * - remaining product / company fields stay empty when the tree has no
 *   dedicated node for them
 */
export function convertBuilderToMIC(page: PageDocument): MICPageSchema {
  const headings = collectByType(page.root, 'heading')
  const texts = collectByType(page.root, 'text')
  const images = collectByType(page.root, 'image')

  const firstHeading = headings[0]
  const productName = firstHeading
    ? readStringProp(firstHeading, 'text') || page.name
    : page.name

  const description = texts
    .map((node) => readStringProp(node, 'text'))
    .filter((text) => text.length > 0)
    .join('\n\n')

  const mappedImages: ImageSchema[] = images.map((node, index) =>
    parseImageSchema(
      {
        id: node.id,
        url: readStringProp(node, 'src'),
        type: 'unknown',
        order: index,
        source: 'PAGE',
      },
      index,
    ),
  )

  const updatedAt = page.updatedAt || new Date().toISOString()

  return createMICPageSchema({
    product: {
      id: page.id,
      productName,
      description,
      images: mappedImages,
      sourceInfo: {
        url: '',
        platform: 'PAGE_BUILDER',
        externalId: page.id,
      },
    },
    company: {},
    metadata: {
      createdAt: updatedAt,
      updatedAt,
      version: '0.3.0',
    },
  })
}

function node(
  type: string,
  props: Record<string, unknown>,
  options: { styles?: ResponsiveStyles; children?: EditorNode[] } = {},
): EditorNode {
  const built: EditorNode = {
    id: createId(type.slice(0, 3)),
    type,
    props,
    styles: options.styles ?? {},
  }
  if (options.children) built.children = options.children
  return built
}

function heading(text: string, level: 'h1' | 'h2' = 'h2'): EditorNode {
  return node('heading', { text, level })
}

function paragraph(text: string): EditorNode {
  return node('text', { text })
}

function picture(image: ImageSchema): EditorNode {
  return node('image', { src: image.url, alt: image.type === 'unknown' ? '' : image.type })
}

function section(children: EditorNode[]): EditorNode {
  return node(
    'section',
    { contentWidth: 'boxed' },
    {
      styles: {
        desktop: {
          paddingTop: '56px',
          paddingBottom: '56px',
          paddingLeft: '24px',
          paddingRight: '24px',
        },
      },
      children,
    },
  )
}

/**
 * Project a `MICPageSchema` onto a builder `PageDocument`.
 *
 * Empty MIC fields are omitted from the tree (no placeholder sections).
 * Structural fields the builder cannot store (keywords, FAQ objects, …)
 * are serialised into text blocks so the copy is not silently discarded.
 */
export function convertMICToBuilder(mic: MICPageSchema): PageDocument {
  const children: EditorNode[] = []
  const product = mic.product
  const company = mic.company

  const hero: EditorNode[] = []
  if (product.productName.trim() !== '') hero.push(heading(product.productName, 'h1'))
  if (product.description.trim() !== '') hero.push(paragraph(product.description))
  if (hero.length > 0) children.push(section(hero))

  const imageNodes = product.images
    .filter((image) => image.url.trim() !== '')
    .sort((left, right) => left.order - right.order)
    .map(picture)
  if (imageNodes.length > 0) children.push(section(imageNodes))

  if (product.specifications.length > 0) {
    const lines = product.specifications
      .map((row) => [row.name, row.value].filter((part) => part.length > 0).join(': '))
      .filter((line) => line.length > 0)
    if (lines.length > 0) {
      children.push(section([heading('Specifications'), paragraph(lines.join('\n'))]))
    }
  }

  if (product.certifications.length > 0) {
    children.push(
      section([heading('Certifications'), paragraph(product.certifications.join('\n'))]),
    )
  }

  if (product.faq.length > 0) {
    const lines = product.faq
      .map((entry) => {
        const question = entry.question.trim()
        const answer = entry.answer.trim()
        if (question === '' && answer === '') return ''
        return [question && `Q: ${question}`, answer && `A: ${answer}`]
          .filter((part): part is string => Boolean(part))
          .join('\n')
      })
      .filter((line) => line.length > 0)
    if (lines.length > 0) children.push(section([heading('FAQ'), paragraph(lines.join('\n\n'))]))
  }

  const companyBlocks: EditorNode[] = []
  if (company.name.trim() !== '') companyBlocks.push(heading(company.name))
  if (company.description.trim() !== '') companyBlocks.push(paragraph(company.description))
  for (const url of company.factoryImages) {
    if (url.trim() !== '') {
      companyBlocks.push(node('image', { src: url, alt: 'factory' }))
    }
  }
  if (companyBlocks.length > 0) children.push(section(companyBlocks))

  const stamp = mic.metadata.updatedAt || new Date().toISOString()
  const root: EditorNode = {
    id: 'root',
    type: ROOT_TYPE,
    props: {},
    styles: { desktop: { backgroundColor: '#ffffff', minHeight: '100%' } },
    children,
  }

  return {
    id: product.id || createId('page'),
    name: product.productName || 'Untitled page',
    schemaVersion: SCHEMA_VERSION,
    root,
    updatedAt: stamp,
  }
}
