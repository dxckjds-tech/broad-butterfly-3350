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
import { runMicAgents } from '../services/agentService'
import { parseAssignments, createAssignedProviders } from '../../ai/providers/agentProvider'
import { createMICPageFromTemplate } from '../services/templateService'
import { useEditorStore } from '../../editor/store/editorStore'

export function useMicStudio() {
  const replacePage = useEditorStore((state) => state.replacePage)
  const dirty = useEditorStore((state) => state.dirty)
  const setNotice = useEditorStore((state) => state.setNotice)

  const [micPage, setMicPage] = useState<MICPageSchema>(() => emptyMICPageSchema())
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([])
  const [suggestNonce, setSuggestNonce] = useState(0)
  const [agentBusy, setAgentBusy] = useState(false)

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

  const runAgents = useCallback(async () => {
    setAgentBusy(true)
    try {
      const env = {
        vision: import.meta.env.VITE_AGENT_VISION,
        keyword: import.meta.env.VITE_AGENT_KEYWORD,
        content: import.meta.env.VITE_AGENT_CONTENT,
        verification: import.meta.env.VITE_AGENT_VERIFICATION,
      }
      const assignments = parseAssignments(env)
      const providers = createAssignedProviders(assignments, {
        openai: import.meta.env.VITE_OPENAI_API_KEY,
        gemini: import.meta.env.VITE_GEMINI_API_KEY,
        deepseek: import.meta.env.VITE_DEEPSEEK_API_KEY,
        kimi: import.meta.env.VITE_KIMI_API_KEY,
        claude: import.meta.env.VITE_ANTHROPIC_API_KEY,
      })
      const result = await runMicAgents({ page: micPage, assignments, providers })
      setSuggestions(result.suggestions)
      setSuggestNonce((value) => value + 1)
      if (result.suggestions.length === 0) {
        setNotice(result.warnings[0] ?? 'No AI suggestions (models unassigned or failed)')
      } else {
        setNotice('AI suggestions ready — accept to apply')
      }
    } finally {
      setAgentBusy(false)
    }
  }, [micPage, setNotice])

  return {
    suggestions,
    suggestNonce,
    agentBusy,
    applyMicTemplate,
    approveSuggestion,
    rejectSuggestion,
    runAgents,
  }
}
