type DiagnosticDetails = Record<string, unknown>;

const SENSITIVE_KEY_PATTERN = /(password|token|secret|authorization|session|key)/i;

function sanitize(details: DiagnosticDetails = {}) {
  return Object.fromEntries(
    Object.entries(details).filter(([key]) => !SENSITIVE_KEY_PATTERN.test(key)),
  );
}

export function logAuthDiagnostic(event: string, details: DiagnosticDetails = {}) {
  if (typeof console === 'undefined') return;
  console.info('[auth]', event, sanitize(details));
}

export function logAuthWarning(event: string, details: DiagnosticDetails = {}) {
  if (typeof console === 'undefined') return;
  console.warn('[auth]', event, sanitize(details));
}
