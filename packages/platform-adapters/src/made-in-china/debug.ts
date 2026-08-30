export function isParserDebugEnabled(): boolean {
  try {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
      ?.env;
    const fromProcess = String(env?.VITE_PARSER_DEBUG ?? '');
    return fromProcess.toLowerCase() === 'true';
  } catch {
    return false;
  }
}
