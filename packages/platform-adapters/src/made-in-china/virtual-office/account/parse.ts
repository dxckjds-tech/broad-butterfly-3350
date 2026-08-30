import type { MICAccountInfo, MICAccountRole } from '@trade-ai/shared-types';
import { parsePermissions } from '../shared/permission';

export function parseVoAccount(doc: Document, _url: string, checkedAt = new Date().toISOString()): MICAccountInfo {
  const label =
    doc.querySelector('[data-mic-account-label]')?.textContent?.trim() ||
    doc.querySelector('.account-name, .member-name')?.textContent?.trim() ||
    'MIC 账号';
  const roleText = doc.querySelector('[data-mic-account-role]')?.textContent?.trim() || '';
  let accountType: MICAccountRole = 'UNKNOWN';
  if (/main|主账号|administrator/i.test(roleText)) accountType = 'MAIN_ACCOUNT';
  if (/sub|子账号|operator/i.test(roleText)) accountType = 'SUB_ACCOUNT';
  const nav = doc.body?.innerText?.slice(0, 2500) ?? '';
  return {
    accountLabel: label.slice(0, 80),
    accountType,
    permissions: parsePermissions(`${roleText} ${nav}`),
    lastLoginDetectedAt: checkedAt,
  };
}
