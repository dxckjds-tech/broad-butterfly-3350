;(function (root) {
  'use strict'
  const ns = (root.ASD = root.ASD || {})

  ns.piiPatterns = {
    email: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    phone: /(?<![\w.])(?:\+?86[-\s]?)?1[3-9]\d{9}(?![\w.])|\+\d{1,3}[-\s]\d{2,4}[-\s]\d{3,4}[-\s]\d{4}/g,
    secret:
      /\b(?:sk-[A-Za-z0-9]{16,}|Bearer\s+[A-Za-z0-9._\-]{16,}|(?:api[_-]?key|access[_-]?token|sessionid|authorization|cookie)\s*[:=]\s*[^\s,;]{8,})\b/gi,
    id: /\b[1-9]\d{5}(?:18|19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/g,
    card: /\b(?:\d{4}[-\s]){3}\d{4}\b/g,
    injection: [
      { type: 'ignore_previous', re: /ignore\s+(all\s+)?previous\s+instructions/i },
      { type: 'system_prompt', re: /system\s+prompt|developer\s+(prompt|message)/i },
      { type: 'role_switch', re: /\b(you are now|act as|forget your instructions)\b/i },
      { type: 'format_override', re: /output\s+only\s+hello|set\s+confidence\s+to\s+100/i },
    ],
  }
})(typeof globalThis !== 'undefined' ? globalThis : self)
