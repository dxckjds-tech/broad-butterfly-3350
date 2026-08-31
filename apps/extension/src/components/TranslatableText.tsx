import { useState } from 'react';
import { AI_UNAVAILABLE_COPY, translateAiText } from '../services/ai';

async function copy(text: string): Promise<void> {
  try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
}

export function TranslatableText({ text, className }: { text: string; className?: string }) {
  const [translated, setTranslated] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  async function toggle(): Promise<void> {
    if (translated) { setOpen((v) => !v); return; }
    setLoading(true); setError('');
    try {
      const result = await translateAiText(text, 'zh-CN');
      setTranslated(result.translated); setOpen(true);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : AI_UNAVAILABLE_COPY);
    } finally { setLoading(false); }
  }

  return (
    <div className={className}>
      <p>{text}</p>
      <div className="translation__actions">
        <button type="button" onClick={() => void toggle()} disabled={loading}>
          {loading ? '翻译中…' : translated && open ? '收起翻译' : '翻译'}
        </button>
        <button type="button" onClick={() => void copy(text)}>复制英文</button>
        {translated ? <button type="button" onClick={() => void copy(translated)}>复制中文</button> : null}
      </div>
      {open && translated ? <p className="translation__result">{translated}</p> : null}
      {error ? <p className="ai-title__error">{error}</p> : null}
    </div>
  );
}
