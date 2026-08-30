export function isParserDebugEnabled(): boolean {
  try {
    const meta = import.meta as ImportMeta & { env?: { VITE_PARSER_DEBUG?: string } };
    const fromImport = String(meta.env?.VITE_PARSER_DEBUG ?? '');
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
      ?.env;
    const fromProcess = String(env?.VITE_PARSER_DEBUG ?? '');
    return fromImport.toLowerCase() === 'true' || fromProcess.toLowerCase() === 'true';
  } catch {
    return false;
  }
}
