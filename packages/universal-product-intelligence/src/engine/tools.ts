import type { ToolInvocation, ToolStatus } from '@trade-ai/shared-types';

export interface ToolResult<T> {
  status: ToolStatus;
  attempts: number;
  data: T | null;
  message: string;
  invocation: ToolInvocation;
}

const cache = new Map<string, ToolResult<unknown>>();

export function hashToolInput(input: unknown): string {
  const s = JSON.stringify(input);
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

async function withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('TIMEOUT')), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function runToolOnce<T>(opts: {
  tool: ToolInvocation['tool'];
  input: unknown;
  timeoutMs?: number;
  fn: () => Promise<T>;
}): Promise<ToolResult<T>> {
  const inputHash = hashToolInput(opts.input);
  const cacheKey = `${opts.tool}:${inputHash}`;
  const hit = cache.get(cacheKey) as ToolResult<T> | undefined;
  if (hit) return hit;

  const timeoutMs = opts.timeoutMs ?? 800;
  let attempts = 0;
  let lastMessage = '';
  let status: ToolStatus = 'ERROR';
  let data: T | null = null;

  while (attempts < 2 && data == null && status !== 'UNAVAILABLE' && status !== 'OK') {
    attempts += 1;
    try {
      data = await withTimeout(opts.fn, timeoutMs);
      status = 'OK';
      lastMessage = 'ok';
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'error';
      lastMessage = msg;
      status = msg === 'TIMEOUT' ? 'TIMEOUT' : msg === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'ERROR';
      if (attempts >= 2) break;
    }
  }

  const result: ToolResult<T> = {
    status,
    attempts,
    data,
    message: lastMessage,
    invocation: { tool: opts.tool, status, attempts, inputHash, message: lastMessage },
  };
  cache.set(cacheKey, result as ToolResult<unknown>);
  return result;
}

export async function imageAnalyzer(input: { imageUrls: string[] }): Promise<ToolResult<null>> {
  return runToolOnce({
    tool: 'imageAnalyzer',
    input,
    fn: async () => {
      throw new Error('UNAVAILABLE');
    },
  });
}

export async function searchDataProvider(input: { phrases: string[] }): Promise<ToolResult<null>> {
  return runToolOnce({
    tool: 'searchDataProvider',
    input,
    fn: async () => {
      throw new Error('UNAVAILABLE');
    },
  });
}

export function resetToolCache(): void {
  cache.clear();
}
