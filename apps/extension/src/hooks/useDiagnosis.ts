import type { DiagnosisResult, DiagnosisUiState, PlatformPageData } from '@trade-ai/shared-types';
import { useCallback, useState } from 'react';
import { diagnosePage, pingHealth } from '../services/diagnosis';
import { queryActiveTab, reloadAndWait, requestPageData } from '../services/messaging';

export function useDiagnosis() {
  const [state, setState] = useState<DiagnosisUiState>('READY');
  const [page, setPage] = useState<PlatformPageData | null>(null);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [error, setError] = useState('');

  const loadPage = useCallback(async (reloadTab = false) => {
    setError('');
    try {
      const tab = await queryActiveTab();
      if (!tab?.id || !tab.url) {
        setState('UNRECOGNIZED');
        setPage(null);
        return;
      }
      if (reloadTab) {
        await reloadAndWait(tab.id);
      }
      try {
        const data = await requestPageData(tab.id);
        setPage(data);
        if (data.pageType === 'UNKNOWN' && data.platform === 'UNKNOWN') {
          setState('UNRECOGNIZED');
        } else {
          setState('READY');
        }
      } catch {
        setPage({
          platform: 'UNKNOWN',
          pageType: 'UNKNOWN',
          url: tab.url,
          title: tab.title ?? '',
          companyName: '',
          productName: '',
          description: '',
          keywords: [],
          images: [],
          specifications: {},
          category: '',
          moq: '',
          deliveryTime: '',
          oemAvailable: false,
          certifications: [],
          rawText: '',
          capturedAt: new Date().toISOString(),
        });
        setState('CAPTURE_FAILED');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown');
      setState('CAPTURE_FAILED');
    }
  }, []);

  const run = useCallback(async () => {
    if (!page) return;
    setState('ANALYZING');
    setError('');
    const online = await pingHealth();
    if (!online) {
      setState('OFFLINE');
      setError('后端离线，请确认 API 已启动（http://localhost:3000/api/health）。');
      return;
    }
    try {
      const next = await diagnosePage(page);
      setResult(next);
      setState('SUCCESS');
    } catch (err) {
      const message = err instanceof Error ? err.message : '分析失败';
      if (message === 'OFFLINE') {
        setState('OFFLINE');
        setError('后端离线或无法连接。');
        return;
      }
      setState('FAILED');
      setError(message);
    }
  }, [page]);

  return { state, page, result, error, loadPage, run };
}
