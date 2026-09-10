/**
 * Declared capabilities per provider brand.
 * This is not a model picker — it only answers "can this brand do vision?".
 * DeepSeek / Kimi are text-only here so assigning them to vision is a
 * ROLE_CAPABILITY_MISMATCH instead of a silent swap.
 */
import type { TaskCapability } from '../agents/types'
import type { ProviderId } from './types'

const TEXT: readonly TaskCapability[] = ['keyword', 'content', 'verification']
const TEXT_AND_VISION: readonly TaskCapability[] = ['vision', 'keyword', 'content', 'verification']

export function capabilitiesForProvider(id: ProviderId): readonly TaskCapability[] {
  switch (id) {
    case 'openai':
    case 'gemini':
    case 'claude':
      return TEXT_AND_VISION
    case 'deepseek':
    case 'kimi':
      return TEXT
  }
}
