export function isParserDebugEnabled(): boolean {
  try {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    const values = [env?.PARSER_DEBUG, env?.VITE_PARSER_DEBUG];
    return values.some((v) => String(v).toLowerCase() === 'true');
  } catch {
    return false;
  }
}
