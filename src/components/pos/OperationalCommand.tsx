"use client";
import { useEffect, useRef, useState } from "react";
import { posWrite } from "@/lib/pos/client";

type Intent = { action: string; body: Record<string, unknown> };
export function useOperationalCommand(scope: string) {
  const [pending, setPending] = useState<Intent | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const running = useRef(false);
  const storage = `td.pos.operation.${scope}`;
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(storage);
        if (raw) {
          const value = JSON.parse(raw);
          if (!value?.action || !value?.body?.key) throw Error();
          setPending(value);
        }
        setReady(true);
      } catch {
        setMessage(
          "Saved operation could not be read. Review register history before continuing.",
        );
      }
    });
  }, [storage]);
  async function execute<T>(intent: Intent): Promise<T | undefined> {
    if (running.current || !ready) return;
    running.current = true;
    setBusy(true);
    setMessage("");
    try {
      localStorage.setItem(storage, JSON.stringify(intent));
      setPending(intent);
      const result = await posWrite<T>(intent.action, intent.body);
      localStorage.removeItem(storage);
      setPending(null);
      return result;
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "";
      if (
        code.startsWith("POS_") &&
        !["POS_UNAVAILABLE", "POS_RETRY"].includes(code)
      ) {
        localStorage.removeItem(storage);
        setPending(null);
      }
      setMessage(
        error instanceof Error
          ? error.message
          : "Operation needs confirmation. Retry the saved request.",
      );
      return undefined;
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return {
    locked: busy || !ready || Boolean(pending),
    busy,
    pending,
    message,
    setMessage,
    run: <T,>(action: string, body: Record<string, unknown>) =>
      pending
        ? Promise.resolve(undefined)
        : execute<T>({ action, body: { ...body, key: crypto.randomUUID() } }),
    retry: <T,>() =>
      pending ? execute<T>(pending) : Promise.resolve(undefined),
  };
}
export function OperationNotice({
  operation,
  onRecovered,
}: {
  operation: ReturnType<typeof useOperationalCommand>;
  onRecovered: () => void;
}) {
  return (
    <>
      <p role="status">{operation.message}</p>
      {operation.pending && (
        <div className="pos-recovery">
          <strong>Operation awaiting confirmation</strong>
          <p>Retry the saved request before recording another cash movement.</p>
          <button
            disabled={operation.busy}
            onClick={async () => {
              const result = await operation.retry();
              if (result) onRecovered();
            }}
          >
            Retry saved operation
          </button>
        </div>
      )}
    </>
  );
}
