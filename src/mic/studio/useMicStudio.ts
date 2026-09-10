/**
 * Local (component) state for MIC templates and AI suggestions.
 *
 * Not a Zustand store. Services stay pure; this hook is the only place that
 * calls `replacePage` so the existing canvas can show the converted tree.
 */
import { useCallback, useState } from 'react'
import type { AISuggestion } from '../../ai/protocol/suggestion'
import { emptyMICPageSchema } from '../schema/page'
import type { MICPageSchema } from '../schema/page'
import { convertMICPageToBuilder } from '../adapters/micComponentAdapter'
import {
  confirmSuggestion,
  createPreviewSuggestions,
  declineSuggestion,
  replaceSuggestion,
} from '../services/suggestionService'
import { createMICPageFromTemplate } from '../services/templateService'
import { useEditorStore } from '../../editor/store/editorStore'

export function useMicStudio() {
  const replacePage = useEditorStore((state) => state.replacePage)
  const dirty = useEditorStore((state) => state.dirty)
  const setNotice = useEditorStore((state) => state.setNotice)

  const [micPage, setMicPage] = useState<MICPageSchema>(() => emptyMICPageSchema())
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([])
  const [suggestNonce, setSuggestNonce] = useState(0)

  const publish = useCallback(
    (page: MICPageSchema, notice: string) => {
      setMicPage(page)
      replacePage(convertMICPageToBuilder(page))
      setNotice(notice)
    },
    [replacePage, setNotice],
  )

  const applyMicTemplate = useCallback(
    (templateId: string) => {
      if (dirty && !window.confirm('Replace the current page? Unsaved changes will be lost.')) {
        return
      }
      const result = createMICPageFromTemplate(templateId)
      if (!result.ok) {
        setNotice(result.error)
        return
      }
      publish(result.page, `Applied MIC template`)
      setSuggestions(createPreviewSuggestions(result.page))
      setSuggestNonce((value) => value + 1)
    },
    [dirty, publish, setNotice],
  )

  const approveSuggestion = useCallback(
    (id: string) => {
      const current = suggestions.find((entry) => entry.id === id)
      if (!current) return
      const result = confirmSuggestion(micPage, current)
      setSuggestions(replaceSuggestion(suggestions, result.suggestion))
      if (!result.ok) {
        setNotice(result.error)
        return
      }
      publish(result.page, `Accepted “${result.suggestion.title}”`)
    },
    [micPage, publish, setNotice, suggestions],
  )

  const rejectSuggestion = useCallback(
    (id: string) => {
      const current = suggestions.find((entry) => entry.id === id)
      if (!current) return
      const result = declineSuggestion(micPage, current)
      setSuggestions(replaceSuggestion(suggestions, result.suggestion))
      setNotice(`Rejected “${current.title}”`)
    },
    [micPage, setNotice, suggestions],
  )

  return { suggestions, suggestNonce, applyMicTemplate, approveSuggestion, rejectSuggestion }
}
