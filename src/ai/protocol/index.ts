/**
 * Public barrel for the AI Patch Protocol.
 * Does not import page-builder store, canvas, or history modules.
 */
export {
  applyPatch,
  createPatch,
  parsePatch,
  PATCH_ACTIONS,
  PATCH_SOURCES,
} from './patch'
export type {
  ApplyPatchResult,
  Patch,
  PatchAction,
  PatchInsertValue,
  PatchMoveValue,
  PatchSource,
} from './patch'
export {
  applySuggestion,
  approveSuggestion,
  createSuggestion,
  parseSuggestion,
  rejectSuggestion,
  SUGGESTION_RISKS,
  SUGGESTION_STATUSES,
} from './suggestion'
export type { AISuggestion, SuggestionRisk, SuggestionStatus } from './suggestion'
export {
  HIGH_RISK_TARGETS,
  validatePatch,
  validateSuggestion,
  VALIDATION_STATUSES,
} from './validation'
export type { ValidationResult, ValidationStatus } from './validation'
