"use client";
import { useCallback, useEffect, useState } from "react";
import { paymentRequest } from "@/lib/pos/payments/client";
import { paymentStates, type Payment } from "@/lib/pos/payments/domain";
import { money } from "@/lib/pos/domain";
export function PaymentHistory({ saleId }: { saleId?: string }) {
  const [rows, setRows] = useState<Payment[]>([]);
  const [status, setStatus] = useState("");
  const [provider, setProvider] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const params = new URLSearchParams({
      status,
      provider,
      ...(saleId ? { saleId } : {}),
    });
    setRows(await paymentRequest<Payment[]>(`?${params}`));
  }, [status, provider, saleId]);
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({
      status,
      provider,
      ...(saleId ? { saleId } : {}),
    });
    paymentRequest<Payment[]>(`?${params}`)
      .then((v) => {
        if (active) setRows(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [status, provider, saleId]);
  async function act(path: string, body: Record<string, unknown> = {}) {
    setBusy(true);
    setError("");
    try {
      await paymentRequest(path, body);
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Payment status is being verified.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="pos-panel">
      <h2>Payments & recovery</h2>
      <p>
        Verify the existing payment before taking another payment. Amounts below
        are separate from sale completion.
      </p>
      <div className="pos-form-grid">
        <label>
          Payment provider
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            <option value="">All</option>
            {process.env.NODE_ENV !== "production" && <option>MOCK</option>}
            <option>EXTERNAL</option>
          </select>
        </label>
        <label>
          Payment status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            {paymentStates.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      {!rows.length && <p>No matching payment attempts.</p>}
      {rows.map((p) => (
        <article key={p.id} className="pos-panel">
          <h3>
            {p.provider} · {p.status} · {money(p.amountMinor)}
          </h3>
          <p>Sale: {p.saleState.replaceAll("_", " ")}</p>
          <p>
            Started: {new Date(p.createdAt).toLocaleString()}
            {p.completedAt &&
              ` · Completed: ${new Date(p.completedAt).toLocaleString()}`}
          </p>
          <p>
            Reference: {p.providerReference ?? "Awaiting provider"} · Last
            check:{" "}
            {p.reconciledAt
              ? new Date(p.reconciledAt).toLocaleString()
              : "Not checked"}
          </p>
          {p.saleId && (
            <a href={`/dashboard/pos/transactions/${p.saleId}`}>
              View transaction
            </a>
          )}
          <button disabled={busy} onClick={() => void act(`/${p.id}/check`)}>
            Check Payment Status
          </button>
          {!p.saleId && p.saleState !== "VOIDED" && (
            <button
              disabled={busy || p.status === "SUCCEEDED"}
              onClick={() => void act(`/${p.id}/cancel`)}
            >
              Cancel payment
            </button>
          )}
          {["RECOVERY_REQUIRED", "FINALIZING"].includes(p.saleState) && (
            <p role="alert">
              Payment succeeded. Restore fulfillment authorization or ask a
              manager to refund this unfulfilled payment. Do not charge again.
            </p>
          )}
          {["RECOVERY_REQUIRED", "FINALIZING"].includes(p.saleState) && (
            <button
              disabled={busy}
              onClick={() => {
                const key = `td.pos.recovery-refund.${p.id}`;
                let saved = localStorage.getItem(key);
                if (!saved) {
                  saved = crypto.randomUUID();
                  localStorage.setItem(key, saved);
                }
                void act(`/${p.id}/refunds`, {
                  key: saved,
                  intent: {
                    reason: "Manager recovery: unable to fulfill paid checkout",
                  },
                });
              }}
            >
              Refund unfulfilled payment (manager)
            </button>
          )}
          {p.refunds.map((r) => (
            <p key={r.id}>
              Refund {money(r.amountMinor)} · {r.status}
              {r.recoveryRequired ? " · Return completion needs review" : ""}
              {(r.status === "UNKNOWN" ||
                r.status === "PENDING" ||
                r.recoveryRequired) && (
                <button
                  disabled={busy}
                  onClick={() => void act(`/refunds/${r.id}/check`)}
                >
                  Check Refund Status
                </button>
              )}
            </p>
          ))}
        </article>
      ))}
    </section>
  );
}
