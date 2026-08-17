export function logStartupCheckpoint(message: string) {
  if (typeof console === 'undefined') return;
  console.info(`[TD_STARTUP] ${message}`);
}

