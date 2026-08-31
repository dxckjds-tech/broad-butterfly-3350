import { useEffect, useState } from 'react';
import type { AiHealthPayload } from '@trade-ai/shared-types';
import { fetchAiHealth } from '../services/ai';
import { DEFAULT_API_BASE_URL, ensureApiHostAccess, getApiBaseUrl, setApiBaseUrl } from '../utils/config';

function statusLabel(health: AiHealthPayload | null, failed: boolean): { text: string; ok: boolean; hint: string } {
  if (failed || !health) {
    return {
      text: 'DeepSeek · 连不上 API',
      ok: false,
      hint: '插件要访问下面这个地址。本机没开后端时，请粘贴云端 API，或在项目里运行 pnpm dev:api。',
    };
  }
  if (health.status === 'connected' && health.provider === 'deepseek') {
    return { text: 'DeepSeek · 已连接', ok: true, hint: '密钥在服务器，不会写入插件。' };
  }
  if (health.status === 'mock' || health.provider === 'mock') {
    return {
      text: 'DeepSeek · 未配置密钥',
      ok: false,
      hint: 'API 已通，但服务器还没有 DEEPSEEK_API_KEY。',
    };
  }
  return {
    text: 'DeepSeek · 服务不可用',
    ok: false,
    hint: '本地规则诊断仍然有效。',
  };
}

export function AiStatusBar() {
  const [text, setText] = useState('DeepSeek · 检测中');
  const [ok, setOk] = useState(false);
  const [hint, setHint] = useState('');
  const [apiInput, setApiInput] = useState(DEFAULT_API_BASE_URL);
  const [busy, setBusy] = useState(false);

  async function probe(baseOverride?: string): Promise<void> {
    setBusy(true);
    try {
      const health = await fetchAiHealth(baseOverride);
      const next = statusLabel(health, false);
      setOk(next.ok);
      setText(next.text);
      setHint(next.hint);
    } catch {
      const next = statusLabel(null, true);
      setOk(false);
      setText(next.text);
      setHint(next.hint);
    } finally {
      setBusy(false);
    }
  }

  async function connect(): Promise<void> {
    const granted = await ensureApiHostAccess(apiInput);
    if (!granted) {
      setOk(false);
      setText('DeepSeek · 未授权访问该地址');
      setHint('请在 Chrome 弹窗里允许访问该 API 域名。');
      return;
    }
    const saved = await setApiBaseUrl(apiInput);
    setApiInput(saved);
    await probe(saved);
  }

  useEffect(() => {
    let cancelled = false;
    void getApiBaseUrl().then((base) => {
      if (cancelled) return;
      setApiInput(base);
      void probe(base);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- probe on mount only
  }, []);

  return (
    <div className={`ai-status ${ok ? 'ai-status--ok' : 'ai-status--down'}`}>
      <span>AI服务状态</span>
      <strong>{busy ? 'DeepSeek · 检测中' : text}</strong>
      {hint ? <p>{hint}</p> : null}
      <label className="ai-status__api">
        <span>API 地址</span>
        <input
          type="url"
          value={apiInput}
          onChange={(e) => setApiInput(e.target.value)}
          placeholder={DEFAULT_API_BASE_URL}
          autoComplete="off"
        />
      </label>
      <button type="button" className="ghost" disabled={busy} onClick={() => void connect()}>
        {busy ? '连接中…' : '连接 API'}
      </button>
    </div>
  );
}
