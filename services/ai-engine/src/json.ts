export function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? trimmed).trim();
  const start = body.search(/[{[]/);
  if (start < 0) return body;
  const opener = body[start];
  const closer = opener === '{' ? '}' : ']';
  let depth = 0;
  for (let i = start; i < body.length; i += 1) {
    if (body[i] === opener) depth += 1;
    if (body[i] === closer) depth -= 1;
    if (depth === 0) return body.slice(start, i + 1);
  }
  return body.slice(start);
}

export function parseJsonLoose(raw: string): unknown {
  const text = extractJsonText(raw);
  return JSON.parse(text) as unknown;
}
