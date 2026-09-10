import { describe, expect, it } from 'vitest'
import { createId } from '../ids'

describe('runner', () => {
  it('boots and can import core modules', () => {
    expect(createId('n')).toMatch(/^n/)
  })
})
