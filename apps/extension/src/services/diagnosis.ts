import type { ApiResponse, DiagnosisResult, PlatformPageData } from '@trade-ai/shared-types';
import { API_BASE_URL } from '../utils/config';

export async function diagnosePage(page: PlatformPageData): Promise<DiagnosisResult> {
  const response = await fetch(`${API_BASE_URL}/diagnosis/page`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(page),
  });

  if (!response.ok && response.status === 0) {
    throw new Error('OFFLINE');
  }

  let payload: ApiResponse<DiagnosisResult>;
  try {
    payload = (await response.json()) as ApiResponse<DiagnosisResult>;
  } catch {
    throw new Error('OFFLINE');
  }

  if (!payload.success) {
    throw new Error(payload.message || 'Diagnosis failed');
  }
  return payload.data;
}

export async function pingHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
