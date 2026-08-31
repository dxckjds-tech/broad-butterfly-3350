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

export function fetchMicOverview() {
  return getData<Record<string, unknown>>('/mic/overview');
}

export function fetchMicProducts() {
  return getData<{ items: Array<Record<string, unknown>>; total: number }>('/mic/products');
}

export function fetchMicInquiries() {
  return getData<Array<Record<string, unknown>>>('/mic/inquiries');
}

export function fetchMicSourcing() {
  return getData<Array<Record<string, unknown>>>('/mic/sourcing');
}

export function fetchMicOpportunities() {
  return getData<Record<string, unknown>>('/mic/opportunities');
}

export function fetchMicStatus() {
  return getData<Record<string, unknown>>('/integrations/mic/status');
}

export function fetchProductionRuntime() {
  return getData<Record<string, unknown>>('/production/runtime');
}

export function fetchProductionCheck() {
  return getData<Record<string, unknown>>('/production-check');
}

export function fetchProductionValidations() {
  return getData<Record<string, unknown>>('/production-check/validations');
}
