import { useState } from 'react';
import { DEMO_VO_PAYLOAD } from '../services/demo-vo';
import { MIC_VO_URLS, parseCurrentVoDocument, postMicSync, previewMicSync } from '../services/mic-sync';

export function MicSyncBar({ pageUrl }: { pageUrl?: string }) {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{
    products: number;
    inquiries: number;
    rfq: number;
    payload: ReturnType<typeof parseCurrentVoDocument> | typeof DEMO_VO_PAYLOAD;
    parser?: unknown;
  } | null>(null);

  async function buildLivePayload() {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id || !tab.url || !/made-in-china\.com/i.test(tab.url)) {
      throw new Error('请先打开 MIC Virtual Office 页面。');
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
      throw new Error('真实数据同步失败');
    }
    return payload;
  }

  async function previewFromTab() {
    setBusy(true);
    setMsg('');
    try {
      const payload = await buildLivePayload();
      const data = (await previewMicSync(payload)) as {
        estimated?: { products: number; inquiries: number; rfq: number };
        parser?: unknown;
        message?: string;
      };
      setPreview({
        products: data.estimated?.products ?? payload.products.length,
        inquiries: data.estimated?.inquiries ?? payload.inquiries.length,
        rfq: data.estimated?.rfq ?? payload.sourcingRequests.length,
        payload,
        parser: data.parser,
      });
      setMsg(data.message || '请确认后再同步。');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '真实数据同步失败');
    } finally {
      setBusy(false);
    }
  }

  async function confirmSync() {
    if (!preview) return;
    setBusy(true);
    try {
      await postMicSync(preview.payload, true);
      setMsg(`已同步：产品 ${preview.products}，询盘 ${preview.inquiries}，RFQ ${preview.rfq}`);
      setPreview(null);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '真实数据同步失败');
    } finally {
      setBusy(false);
    }
  }

  async function demoPreview() {
    setBusy(true);
    try {
      const data = (await previewMicSync({
        ...DEMO_VO_PAYLOAD,
        syncMeta: { ...DEMO_VO_PAYLOAD.syncMeta, startedAt: new Date().toISOString(), source: 'FIXTURE' },
      })) as { estimated?: { products: number; inquiries: number; rfq: number }; parser?: unknown; message?: string };
      setPreview({
        products: data.estimated?.products ?? 0,
        inquiries: data.estimated?.inquiries ?? 0,
        rfq: data.estimated?.rfq ?? 0,
        payload: {
          ...DEMO_VO_PAYLOAD,
          syncMeta: { ...DEMO_VO_PAYLOAD.syncMeta, startedAt: new Date().toISOString(), source: 'FIXTURE' },
        },
        parser: data.parser,
      });
      setMsg('演示数据预览（DEMO）。生产 LIVE 模式会被拒绝。');
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
        <span>LIVE/DEMO 预览确认 · DRY_RUN 禁止写 MIC</span>
      </div>
      <div className="mic-sync__actions">
        <button type="button" className="ghost" onClick={() => void chrome.tabs.create({ url: MIC_VO_URLS.VIRTUAL_OFFICE })}>
          进入后台
        </button>
        <button type="button" className="ghost" disabled={busy} onClick={() => void previewFromTab()}>
          {busy ? '预览中…' : '同步 MIC'}
        </button>
        <button type="button" className="ghost" disabled={busy} onClick={() => void demoPreview()}>
          演示同步
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => void chrome.tabs.create({ url: 'http://localhost:5173/production-check' })}
        >
          试运行检查
        </button>
      </div>
      {preview ? (
        <div className="mic-sync__hint">
          <p>
            预计读取：{preview.products} 个产品，最近 {preview.inquiries} 条询盘，RFQ {preview.rfq} 条
          </p>
          <button type="button" className="primary" disabled={busy} onClick={() => void confirmSync()}>
            确认同步
          </button>
        </div>
      ) : null}
      {pageUrl ? <p className="mic-sync__hint">当前标签：{pageUrl.slice(0, 64)}</p> : null}
      {msg ? <p className="mic-sync__hint">{msg}</p> : null}
    </section>
  );
}
