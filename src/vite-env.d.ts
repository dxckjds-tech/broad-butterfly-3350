/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AGENT_VISION?: string
  readonly VITE_AGENT_KEYWORD?: string
  readonly VITE_AGENT_CONTENT?: string
  readonly VITE_AGENT_VERIFICATION?: string
  readonly VITE_OPENAI_API_KEY?: string
  readonly VITE_GEMINI_API_KEY?: string
  readonly VITE_DEEPSEEK_API_KEY?: string
  readonly VITE_KIMI_API_KEY?: string
  readonly VITE_ANTHROPIC_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
