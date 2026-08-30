import { diagnosePage as diagnoseLocally } from '@trade-ai/diagnosis-engine';
import type { ApiResponse, DiagnosisResult, PlatformPageData } from '@trade-ai/shared-types';

const DEFAULT_API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export async function getApiBaseUrl(): Promise<string> {
  try {
    const stored = await chrome.storage?.local.get('apiBaseUrl');
    const value = stored?.apiBaseUrl;
    if (typeof value === 'string' && value.trim()) return value.trim().replace(/\/$/, '');
  } catch {
    // storage may be unavailable in some contexts
  }
  return DEFAULT_API.replace(/\/$/, '');
}

export async function diagnosePage(page: PlatformPageData): Promise<DiagnosisResult> {
  const apiBase = await getApiBaseUrl();
  try {
    const response = await fetch(`${apiBase}/diagnosis/page`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(page),
    });
    const payload = (await response.json()) as ApiResponse<DiagnosisResult>;
    if (payload.success) return payload.data;
  } catch {
    // fall through to local rules
  }

  const output = await diagnoseLocally(page);
  return {
    diagnosisId: 'local-offline',
    totalScore: output.result.totalScore,
    scores: output.result.scores,
    issues: output.result.issues,
  };
}

export async function pingHealth(): Promise<boolean> {
  try {
    const apiBase = await getApiBaseUrl();
    const response = await fetch(`${apiBase}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
