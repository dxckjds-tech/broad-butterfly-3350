import type { DiagnosisResult, DiagnosisUiState, PlatformPageData } from '@trade-ai/shared-types';
import { useCallback, useState } from 'react';
import { diagnosePage } from '../services/diagnosis';
import { getIdentityUserVerified, setIdentityUserVerified } from '../services/identity';
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
        const identityUserVerified = await getIdentityUserVerified(data.url || tab.url);
        setPage({ ...data, identityUserVerified });
        if (data.pageType === 'UNKNOWN' && data.platform === 'UNKNOWN') {
          setState('UNRECOGNIZED');
        } else {
          setState('ANALYZING');
          try {
            const diagnosed = await diagnosePage({ ...data, identityUserVerified });
            setResult(diagnosed);
            setState('SUCCESS');
          } catch (err) {
            setState('FAILED');
            setError(err instanceof Error ? err.message : '分析失败');
          }
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

  const setIdentityVerified = useCallback(
    async (verified: boolean) => {
      if (!page) return;
      const next = { ...page, identityUserVerified: verified };
      if (page.url) await setIdentityUserVerified(page.url, verified);
      setPage(next);
      setState('ANALYZING');
      setError('');
      try {
        const diagnosed = await diagnosePage(next);
        setResult(diagnosed);
        setState('SUCCESS');
      } catch (err) {
        setState('FAILED');
        setError(err instanceof Error ? err.message : '分析失败');
      }
    },
    [page],
  );

  const run = useCallback(async () => {
    if (!page) return;
    setState('ANALYZING');
    setError('');
    try {
      const next = await diagnosePage(page);
      setResult(next);
      setState('SUCCESS');
    } catch (err) {
      setState('FAILED');
      setError(err instanceof Error ? err.message : '分析失败');
    }
  }, [page]);

  return { state, page, result, error, loadPage, run, setIdentityVerified };
}
