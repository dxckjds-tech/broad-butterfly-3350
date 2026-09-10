/**
 * Headless verification harness — `npm run smoke`.
 *
 * The production build only proves the project type-checks. This bundles the
 * app for SSR and exercises the pure editor core (reducer, styles, schema,
 * registry) plus a full server render, so import-order and runtime
 * regressions surface without a browser.
 */
import { renderToString } from 'react-dom/server'
import App from '../src/App'
import '../src/editor/components'
import { createNode, getComponent } from '../src/editor/core/registry'
import { applyCommand } from '../src/editor/core/reducer'
import { parsePageDocument } from '../src/editor/core/schema'
import { hasOverride, resolveNodeStyles } from '../src/editor/core/styles'
import { findNode, collectIds } from '../src/editor/core/tree'
import { createEmptyPage } from '../src/editor/store/defaultPage'
import { TEMPLATE_PRESETS } from '../src/editor/presets/templates'
import { SECTION_PRESETS } from '../src/editor/presets/sections'
import type { PageDocument } from '../src/editor/core/types'

let failures = 0

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    console.log(`  ok   ${name}`)
  } else {
    failures += 1
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function group(name: string) {
  console.log(`\n${name}`)
}

// --- registry -----------------------------------------------------------
group('registry')
const v021Types = ['section', 'container', 'columns', 'heading', 'text', 'button', 'image', 'spacer']
check(
  'v0.2.1 eight components still registered',
  v021Types.every((type) => getComponent(type) !== undefined),
)
check(
  'MIC components registered',
  [
    'mic-product-hero',
    'mic-feature-section',
    'mic-specification-table',
    'mic-certification',
    'mic-factory-gallery',
    'mic-packaging',
    'mic-faq',
    'mic-company-profile',
  ].every((type) => getComponent(type) !== undefined),
)
check('root type is hidden from the palette', getComponent('root')?.hidden === true)
check('columns ships with two starter columns', (createNode('columns').children ?? []).length === 2)
check('text does not accept children', getComponent('text')?.acceptsChildren !== true)

// --- reducer ------------------------------------------------------------
group('reducer')
let page: PageDocument = createEmptyPage()
const rootId = page.root.id

const section = createNode('section')
page = applyCommand(page, { type: 'ADD_NODE', parentId: rootId, node: section })
check('ADD_NODE appends to the root', (page.root.children ?? []).length === 1)

const heading = createNode('heading')
page = applyCommand(page, { type: 'ADD_NODE', parentId: section.id, node: heading })
page = applyCommand(page, {
  type: 'UPDATE_PROPS',
  nodeId: heading.id,
  patch: { text: 'Smoke heading' },
})
check('UPDATE_PROPS writes through', findNode(page.root, heading.id)?.props['text'] === 'Smoke heading')

page = applyCommand(page, {
  type: 'UPDATE_STYLE',
  nodeId: heading.id,
  device: 'mobile',
  patch: { fontSize: '20px' },
})
const headingNode = findNode(page.root, heading.id)!
check('mobile override applies', resolveNodeStyles(headingNode, 'mobile')['fontSize'] === '20px')
check('desktop keeps its own value', resolveNodeStyles(headingNode, 'desktop')['fontSize'] !== '20px')
check('override is detected', hasOverride(headingNode.styles, 'mobile', 'fontSize'))

page = applyCommand(page, {
  type: 'UPDATE_STYLE',
  nodeId: heading.id,
  device: 'mobile',
  patch: { fontSize: null },
})
check(
  'null clears the override',
  !hasOverride(findNode(page.root, heading.id)!.styles, 'mobile', 'fontSize'),
)

const beforeDuplicate = collectIds(page.root).length
page = applyCommand(page, { type: 'DUPLICATE_NODE', nodeId: heading.id })
const afterDuplicate = collectIds(page.root)
check('DUPLICATE_NODE clones the subtree', afterDuplicate.length === beforeDuplicate + 1)
check('duplicated ids stay unique', new Set(afterDuplicate).size === afterDuplicate.length)

// A second container at the top level, so the move crosses parents.
const holder = createNode('container')
page = applyCommand(page, { type: 'ADD_NODE', parentId: rootId, node: holder })
const movable = createNode('spacer')
page = applyCommand(page, { type: 'ADD_NODE', parentId: holder.id, node: movable })
page = applyCommand(page, { type: 'MOVE_NODE', nodeId: movable.id, parentId: section.id, index: 0 })
check('MOVE_NODE reparents', (findNode(page.root, section.id)?.children ?? [])[0]?.id === movable.id)

// P0-4: the rule table refuses a bare Spacer at the page root.
const strayBefore = page
const stray = createNode('spacer')
check(
  'root refuses a non-layout child',
  applyCommand(strayBefore, { type: 'ADD_NODE', parentId: rootId, node: stray }) === strayBefore,
)
check(
  'columns refuses a non-container child',
  (() => {
    const cols = createNode('columns')
    const withCols = applyCommand(page, { type: 'ADD_NODE', parentId: rootId, node: cols })
    const text = createNode('text')
    return applyCommand(withCols, { type: 'ADD_NODE', parentId: cols.id, node: text }) === withCols
  })(),
)

const selfMove = applyCommand(page, {
  type: 'MOVE_NODE',
  nodeId: section.id,
  parentId: section.id,
  index: 0,
})
check('a node cannot be moved into itself', selfMove === page)
check('the root cannot be deleted', applyCommand(page, { type: 'DELETE_NODE', nodeId: rootId }) === page)
check(
  'unknown node ids are a no-op',
  applyCommand(page, { type: 'DELETE_NODE', nodeId: 'missing' }) === page,
)

page = applyCommand(page, { type: 'DELETE_NODE', nodeId: movable.id })
check('DELETE_NODE removes the node', findNode(page.root, movable.id) === null)

// --- schema -------------------------------------------------------------
group('schema')
const roundTripped = parsePageDocument(JSON.parse(JSON.stringify(page)))
check('a serialised document round-trips', roundTripped.ok, roundTripped.ok ? '' : roundTripped.error)
const broken = parsePageDocument({ id: 'p', name: 'x', schemaVersion: 1, root: { id: 'r' } })
check('a malformed document is rejected', !broken.ok)
check('rejection carries a readable message', !broken.ok && broken.error.length > 0)

// --- presets ------------------------------------------------------------
group('presets')
for (const preset of TEMPLATE_PRESETS) {
  const result = parsePageDocument(JSON.parse(JSON.stringify(preset.build())))
  check(`template “${preset.label}” is valid`, result.ok, result.ok ? '' : result.error)
}
for (const preset of SECTION_PRESETS) {
  const ids = collectIds(preset.build())
  check(`section “${preset.label}” has unique ids`, new Set(ids).size === ids.length)
}

// --- render -------------------------------------------------------------
group('render')
const html = renderToString(<App />)
check('the shell renders', html.length > 500, `${html.length} chars`)
check('the toolbar is present', html.includes('Page Builder'))
check('the empty state is present', html.includes('This page is empty'))

console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} check(s) failed`}`)
process.exit(failures === 0 ? 0 : 1)
