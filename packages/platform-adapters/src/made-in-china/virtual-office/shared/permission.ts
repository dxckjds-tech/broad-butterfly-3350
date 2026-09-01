import type { MICModuleStatus, MICPermission } from '@trade-ai/shared-types';

const DENIED =
  /no permission|access denied|无权|没有权限|权限不足|please sign in|请先登录|logon\.do|sign-in/i;

export function detectModuleAccess(doc: Document, url: string): MICModuleStatus {
  const text = `${url} ${doc.title ?? ''} ${doc.body?.innerText?.slice(0, 4000) ?? ''}`;
  if (/sign-in|\/logon\.do/i.test(url) && !/doLogout/i.test(url)) return 'NO_PERMISSION';
  if (DENIED.test(text) && /permission|权限|sign in|登录/i.test(text)) return 'NO_PERMISSION';
  const marker = doc.querySelector('[data-mic-access="denied"]');
  if (marker) return 'NO_PERMISSION';
  return 'SUCCESS';
}

export function parsePermissions(text: string): MICPermission[] {
  const perms: MICPermission[] = [];
  if (/product/i.test(text)) perms.push('PRODUCT_VIEW');
  if (/inquiry|询盘/i.test(text)) perms.push('INQUIRY_VIEW');
  if (/sourcing|rfq|采购需求/i.test(text)) perms.push('SOURCING_VIEW');
  return perms.length ? perms : ['UNKNOWN'];
}
