export type ScannerLifecyclePhase =
  | 'mounted'
  | 'exiting'
  | 'unmounted';

export type ScannerLifecycleGuard = {
  readonly phase: ScannerLifecyclePhase;
  readonly pendingOperations: number;
  isLive: (operationId?: string | null) => boolean;
  beginOperation: (operationId: string) => boolean;
  finishOperation: (operationId: string) => void;
  dispose: () => void;
  unmount: () => void;
};

export type ScannerLifecycleSnapshot = {
  phase: ScannerLifecyclePhase;
  pendingOperations: number;
  activeOperationId: string | null;
};

export function createScannerLifecycleGuard(
  onSnapshot?: (snapshot: ScannerLifecycleSnapshot) => void,
): ScannerLifecycleGuard {
  let phase: ScannerLifecyclePhase = 'mounted';
  let activeOperationId: string | null = null;
  const pending = new Set<string>();

  const snapshot = () => {
    onSnapshot?.({
      phase,
      pendingOperations: pending.size,
      activeOperationId,
    });
  };

  return {
    get phase() {
      return phase;
    },
    get pendingOperations() {
      return pending.size;
    },
    isLive(operationId) {
      if (phase !== 'mounted') return false;
      return operationId ? activeOperationId === operationId && pending.has(operationId) : true;
    },
    beginOperation(operationId) {
      if (phase !== 'mounted') return false;
      activeOperationId = operationId;
      pending.add(operationId);
      snapshot();
      return true;
    },
    finishOperation(operationId) {
      pending.delete(operationId);
      if (activeOperationId === operationId) activeOperationId = null;
      snapshot();
    },
    dispose() {
      if (phase === 'unmounted') return;
      phase = 'exiting';
      activeOperationId = null;
      pending.clear();
      snapshot();
    },
    unmount() {
      phase = 'unmounted';
      activeOperationId = null;
      pending.clear();
      snapshot();
    },
  };
}

export function shouldApplyScannerAsyncResult(
  guard: Pick<ScannerLifecycleGuard, 'isLive'>,
  operationId?: string | null,
) {
  return guard.isLive(operationId);
}
