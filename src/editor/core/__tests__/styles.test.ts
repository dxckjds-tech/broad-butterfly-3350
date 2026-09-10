import { describe, expect, it } from 'vitest'
import { hasOverride, mergeStyleLayer, originOf, resolveStyles, toCssProperties } from '../styles'
import type { ResponsiveStyles } from '../types'

const styles: ResponsiveStyles = {
  desktop: { fontSize: '32px', color: '#111827', textAlign: 'left' },
  tablet: { fontSize: '28px' },
  mobile: { fontSize: '22px' },
}

describe('resolveStyles', () => {
  it('desktop sees only the desktop layer', () => {
    expect(resolveStyles(styles, 'desktop')).toEqual({
      fontSize: '32px',
      color: '#111827',
      textAlign: 'left',
    })
  })

  it('tablet inherits desktop and overrides on top', () => {
    const resolved = resolveStyles(styles, 'tablet')
    expect(resolved['fontSize']).toBe('28px')
    expect(resolved['color']).toBe('#111827')
  })

  it('mobile inherits through tablet', () => {
    const partial: ResponsiveStyles = {
      desktop: { fontSize: '32px', color: 'red' },
      tablet: { color: 'blue' },
    }
    const resolved = resolveStyles(partial, 'mobile')
    // mobile declares nothing, so tablet's override wins over desktop.
    expect(resolved).toEqual({ fontSize: '32px', color: 'blue' })
  })

  it('an empty style map resolves to nothing', () => {
    expect(resolveStyles({}, 'mobile')).toEqual({})
  })
})

describe('hasOverride / originOf', () => {
  it('distinguishes a local override from an inherited value', () => {
    expect(hasOverride(styles, 'mobile', 'fontSize')).toBe(true)
    expect(hasOverride(styles, 'mobile', 'color')).toBe(false)
    expect(originOf(styles, 'mobile', 'color')).toBe('desktop')
    expect(originOf(styles, 'mobile', 'fontSize')).toBe('mobile')
    expect(originOf(styles, 'mobile', 'letterSpacing')).toBeNull()
  })

  it('never looks at narrower layers than the current device', () => {
    expect(hasOverride(styles, 'desktop', 'fontSize')).toBe(true)
    expect(originOf(styles, 'desktop', 'fontSize')).toBe('desktop')
    expect(originOf(styles, 'tablet', 'fontSize')).toBe('tablet')
  })
})

describe('mergeStyleLayer', () => {
  it('adds and replaces declarations in one layer', () => {
    const next = mergeStyleLayer(styles, 'tablet', { fontSize: '26px', fontWeight: '700' })
    expect(next.tablet).toEqual({ fontSize: '26px', fontWeight: '700' })
    expect(next.desktop).toBe(styles.desktop)
  })

  it('removes an override on null or empty string', () => {
    const cleared = mergeStyleLayer(styles, 'mobile', { fontSize: null })
    expect(hasOverride(cleared, 'mobile', 'fontSize')).toBe(false)
    // Falls back to the tablet value once the override is gone.
    expect(resolveStyles(cleared, 'mobile')['fontSize']).toBe('28px')

    const blanked = mergeStyleLayer(styles, 'mobile', { fontSize: '' })
    expect(hasOverride(blanked, 'mobile', 'fontSize')).toBe(false)
  })

  it('drops the layer entirely when it becomes empty', () => {
    const cleared = mergeStyleLayer(styles, 'mobile', { fontSize: null })
    expect(cleared.mobile).toBeUndefined()
  })

  it('toCssProperties passes camelCase keys through untouched', () => {
    expect(toCssProperties({ fontSize: '12px' })).toEqual({ fontSize: '12px' })
  })
})
