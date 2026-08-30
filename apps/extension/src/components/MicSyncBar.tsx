import { useState } from 'react';
import { DEMO_VO_PAYLOAD } from '../services/demo-vo';
import { MIC_VO_URLS, parseCurrentVoDocument, postMicSync } from '../services/mic-sync';

export function MicSyncBar({ pageUrl }: { pageUrl?: string }) {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function syncFromTab() {
    setBusy(true);
    setMsg('');
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!tab?.id || !tab.url || !/made-in-china\.com/i.test(tab.url)) {
        setMsg('请先打开 MIC Virtual Office 页面，或使用演示同步。');
        return;
      }
      const injected = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => ({ html: document.documentElement.outerHTML, url: location.href }),
      });
      const page = injected[0]?.result;
      const parser = new DOMParser();
      const doc = parser.parseFromString(page?.html ?? '', 'text/html');
      const payload = parseCurrentVoDocument(doc, page?.url || tab.url);
      if (!payload.products.length && !payload.inquiries.length && !payload.sourcingRequests.length) {
        setMsg('当前页未识别到后台列表。请打开产品/询盘模块后再同步，或使用演示数据。');
        return;
      }
      await postMicSync(payload);
      setMsg(`已同步：产品 ${payload.products.length}，询盘 ${payload.inquiries.length}，RFQ ${payload.sourcingRequests.length}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '同步失败（本地规则诊断仍可用）');
    } finally {
      setBusy(false);
    }
  }

  async function demoSync() {
    setBusy(true);
    try {
      await postMicSync({
        ...DEMO_VO_PAYLOAD,
        syncMeta: { ...DEMO_VO_PAYLOAD.syncMeta, startedAt: new Date().toISOString(), source: 'FIXTURE' },
      });
      setMsg('已提交演示同步（FIXTURE）。不会上传 Cookie。');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '演示同步需要本地 API');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mic-sync">
      <div className="mic-sync__head">
        <strong>MIC 后台</strong>
        <span>Browser Session · 不保存密码/Cookie</span>
      </div>
      <div className="mic-sync__actions">
        <button type="button" className="ghost" onClick={() => void chrome.tabs.create({ url: MIC_VO_URLS.VIRTUAL_OFFICE })}>
          进入后台
        </button>
        <button type="button" className="ghost" disabled={busy} onClick={() => void syncFromTab()}>
          {busy ? '同步中…' : '同步后台数据'}
        </button>
        <button type="button" className="ghost" disabled={busy} onClick={() => void demoSync()}>
          演示同步
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => void chrome.tabs.create({ url: 'http://localhost:5173/mic/products' })}
        >
          运营中心
        </button>
      </div>
      {pageUrl ? <p className="mic-sync__hint">当前标签：{pageUrl.slice(0, 64)}</p> : null}
      {msg ? <p className="mic-sync__hint">{msg}</p> : null}
    </section>
  );
}
