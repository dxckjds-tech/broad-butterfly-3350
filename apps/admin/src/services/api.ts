import type { DashboardStats, ShopSummary } from '@trade-ai/shared-types';
import { getData } from './http';

export function fetchStats() {
  return getData<DashboardStats>('/diagnosis/stats');
}

export function fetchShops() {
  return getData<ShopSummary[]>('/shops');
}

export function fetchReports() {
  return getData<unknown[]>('/diagnosis/reports');
}

export function fetchRules() {
  return getData<unknown[]>('/rules');
}

export function fetchProducts() {
  return getData<unknown[]>('/products');
}
