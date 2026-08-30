import { useEffect, useState } from 'react';
import type { AiHealthPayload } from '@trade-ai/shared-types';
import { fetchAiHealth } from '../services/ai';

function label(health: AiHealthPayload | null, failed: boolean): string {
  if (failed || !health || health.status !== 'connected' || health.provider !== 'deepseek') {
    return 'DeepSeek · 服务不可用';
  }
  return 'DeepSeek · 已连接';
}

export function AiStatusBar() {
  const [text, setText] = useState('DeepSeek · 检测中');
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchAiHealth()
      .then((health) => {
        if (cancelled) return;
        const connected = health.status === 'connected' && health.provider === 'deepseek';
        setOk(connected);
        setText(label(health, false));
      })
      .catch(() => {
        if (cancelled) return;
        setOk(false);
        setText('DeepSeek · 服务不可用');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={`ai-status ${ok ? 'ai-status--ok' : 'ai-status--down'}`}>
      <span>AI服务状态</span>
      <strong>{text}</strong>
      {!ok ? <p>本地规则诊断仍然有效。</p> : null}
    </div>
  );
}
