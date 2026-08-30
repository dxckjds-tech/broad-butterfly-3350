import axios from 'axios';
import type { ApiResponse } from '@trade-ai/shared-types';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  timeout: 20000,
});

export async function getData<T>(url: string): Promise<T> {
  const { data } = await api.get<ApiResponse<T>>(url);
  if (!data.success) {
    throw new Error(data.message || 'Request failed');
  }
  return data.data;
}

export async function postData<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await api.post<ApiResponse<T>>(url, body);
  if (!data.success) {
    throw new Error(data.message || 'Request failed');
  }
  return data.data;
}

export async function deleteData<T>(url: string): Promise<T> {
  const { data } = await api.delete<ApiResponse<T>>(url);
  if (!data.success) {
    throw new Error(data.message || 'Request failed');
  }
  return data.data;
}
