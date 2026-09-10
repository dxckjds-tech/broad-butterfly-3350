import { node } from './build'
import type { EditorNode } from '../core/types'

export interface SectionPreset {
  id: string
  label: string
  description: string
  build: () => EditorNode
}

/**
 * Prebuilt node subtrees inserted via ADD_NODE. Pure data — adding one
 * never requires touching the editor core.
 */
export const SECTION_PRESETS: readonly SectionPreset[] = [
  {
    id: 'hero-centered',
    label: 'Centred hero',
    description: 'Headline, sub-copy and a call to action',
    build: () =>
      node('section', {
        styles: { desktop: { paddingTop: '88px', paddingBottom: '88px', backgroundColor: '#f8fafc' } },
        children: [
          node('container', {
            styles: { desktop: { alignItems: 'center', gap: '18px', textAlign: 'center' } },
            children: [
              node('heading', {
                props: { text: 'Diagnose your store in minutes', level: 'h1' },
                styles: { desktop: { fontSize: '48px', textAlign: 'center' }, mobile: { fontSize: '30px' } },
              }),
              node('text', {
                props: {
                  text: 'Automated audits for conversion, speed and content quality — with a fix list you can actually ship.',
                },
                styles: { desktop: { fontSize: '18px', maxWidth: '620px', textAlign: 'center' } },
              }),
              node('button', {
                props: { label: 'Run a free audit' },
                styles: { desktop: { alignSelf: 'center', paddingTop: '13px', paddingBottom: '13px', paddingLeft: '26px', paddingRight: '26px', fontSize: '15px' } },
              }),
            ],
          }),
        ],
      }),
  },
  {
    id: 'feature-two-column',
    label: 'Two-column feature',
    description: 'Copy beside an image',
    build: () =>
      node('section', {
        children: [
          node('columns', {
            styles: { desktop: { gap: '48px', alignItems: 'center' } },
            children: [
              node('container', {
                styles: { desktop: { flex: '1 1 0%', gap: '14px' } },
                children: [
                  node('heading', { props: { text: 'Every issue, ranked by impact', level: 'h2' } }),
                  node('text', {
                    props: {
                      text: 'We score each finding against revenue impact and effort, so the first item on the list is the one worth doing today.',
                    },
                  }),
                  node('button', { props: { label: 'See a sample report' } }),
                ],
              }),
              node('container', {
                styles: { desktop: { flex: '1 1 0%' } },
                children: [node('image', { props: { alt: 'Report preview' }, styles: { desktop: { height: '320px' } } })],
              }),
            ],
          }),
        ],
      }),
  },
  {
    id: 'cta-banner',
    label: 'CTA banner',
    description: 'Dark full-width conversion band',
    build: () =>
      node('section', {
        styles: { desktop: { backgroundColor: '#0f172a', paddingTop: '64px', paddingBottom: '64px' } },
        children: [
          node('container', {
            styles: { desktop: { alignItems: 'center', gap: '16px', textAlign: 'center' } },
            children: [
              node('heading', {
                props: { text: 'Ready to fix what is costing you orders?', level: 'h2' },
                styles: { desktop: { color: '#ffffff', fontSize: '32px', textAlign: 'center' } },
              }),
              node('button', {
                props: { label: 'Start now' },
                styles: { desktop: { alignSelf: 'center', backgroundColor: '#ffffff', color: '#0f172a' } },
              }),
            ],
          }),
        ],
      }),
  },
  {
    id: 'three-up',
    label: 'Three-up grid',
    description: 'Three short value propositions',
    build: () =>
      node('section', {
        children: [
          node('columns', {
            styles: { desktop: { gap: '28px', alignItems: 'stretch' } },
            children: ['Conversion', 'Performance', 'Content'].map((title) =>
              node('container', {
                styles: {
                  desktop: {
                    flex: '1 1 0%',
                    gap: '10px',
                    padding: '24px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '12px',
                  },
                },
                children: [
                  node('heading', {
                    props: { text: title, level: 'h3' },
                    styles: { desktop: { fontSize: '18px' } },
                  }),
                  node('text', {
                    props: { text: `A short explanation of the ${title.toLowerCase()} checks we run.` },
                    styles: { desktop: { fontSize: '14px' } },
                  }),
                ],
              }),
            ),
          }),
        ],
      }),
  },
]
