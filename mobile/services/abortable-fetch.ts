export type AbortableFetchSignal = {
  signal: AbortSignal;
  cleanup: () => void;
  timedOut: () => boolean;
  callerAborted: () => boolean;
};

export function createAbortableFetchSignal(input: {
  callerSignal?: AbortSignal;
  timeoutMs: number;
}): AbortableFetchSignal {
  const controller = new AbortController();
  let timedOut = false;
  let callerAborted = false;

  const abortFromCaller = () => {
    callerAborted = true;
    controller.abort();
  };

  if (input.callerSignal) {
    if (input.callerSignal.aborted) {
      abortFromCaller();
    } else {
      input.callerSignal.addEventListener('abort', abortFromCaller, { once: true });
    }
  }

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, Math.max(0, Math.round(input.timeoutMs)));

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeout);
      input.callerSignal?.removeEventListener('abort', abortFromCaller);
    },
    timedOut: () => timedOut,
    callerAborted: () => callerAborted,
  };
}
