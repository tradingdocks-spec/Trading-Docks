"use client";
import { paymentRequest } from "@/lib/pos/payments/client";
import type { Payment, RefundAttempt } from "@/lib/pos/payments/domain";

import { useEffect, useState } from "react";
import { money, type Bootstrap } from "@/lib/pos/domain";
import { OperationNotice, useOperationalCommand } from "./OperationalCommand";
export type RefundableItem = {
  id: string;
  name: string;
  quantity: number;
  refundedQuantity: number;
  netMinor: number;
  taxMinor: number;
};
export function RefundPanel({
  saleId,
  items,
  data,
  scope,
}: {
  saleId: string;
  items: RefundableItem[];
  data: Bootstrap;
  scope: string;
}) {
  const [payment, setPayment] = useState<Payment | null>(null);
  const [paymentLoaded, setPaymentLoaded] = useState(false);
  const [providerBusy, setProviderBusy] = useState(false);
  const [providerError, setProviderError] = useState("");
  const [savedRefund, setSavedRefund] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [refundResult, setRefundResult] = useState<RefundAttempt | null>(null);
  const refundKey = `td.pos.provider-refund.${scope}.${saleId}`;
  useEffect(() => {
    let active = true;
    paymentRequest<Payment[]>(`?saleId=${encodeURIComponent(saleId)}`)
      .then((rows) => {
        if (active) {
          setPayment(rows[0] ?? null);
          setPaymentLoaded(true);
        }
      })
      .catch(() => {
        if (active)
          setProviderError(
            "Payment method could not be verified. Refresh before refunding.",
          );
      });
    queueMicrotask(() => {
      if (!active) return;
      try {
        const raw = localStorage.getItem(refundKey);
        if (raw) setSavedRefund(JSON.parse(raw));
      } catch {
        setProviderError("Saved refund needs review.");
      }
    });
    return () => {
      active = false;
    };
  }, [saleId, refundKey]);
  async function providerRefund(payload?: Record<string, unknown>) {
    if (providerBusy || !payment) return;
    setProviderBusy(true);
    setProviderError("");
    try {
      const request = savedRefund ?? {
        key: crypto.randomUUID(),
        intent: payload,
      };
      localStorage.setItem(refundKey, JSON.stringify(request));
      setSavedRefund(request);
      const result = refundResult
        ? await paymentRequest<RefundAttempt>(
            `/refunds/${refundResult.id}/check`,
            {},
          )
        : await paymentRequest<RefundAttempt>(
            `/${payment.id}/refunds`,
            request,
          );
      setRefundResult(result);
      if (result.status === "SUCCEEDED" && !result.recovery_required) {
        localStorage.removeItem(refundKey);
        setSavedRefund(null);
        setComplete(true);
      }
    } catch (e) {
      setProviderError(
        e instanceof Error
          ? e.message
          : "Verify refund status before retrying.",
      );
    } finally {
      setProviderBusy(false);
    }
  }
  const operation = useOperationalCommand(`${scope}.refund`);
  const [sessionId, setSessionId] = useState(
    data.sessions.find((s) => s.status === "OPEN")?.id ?? "",
  );
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [restore, setRestore] = useState<Record<string, boolean>>({});
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState("Customer return");
  const [complete, setComplete] = useState(false);
  const total = items.reduce((sum, i) => {
    const q = BigInt(quantities[i.id] ?? 0);
    const previous = BigInt(i.refundedQuantity);
    const quantity = BigInt(i.quantity);
    return (
      sum +
      Number(
        (BigInt(i.netMinor) * (previous + q)) / quantity -
          (BigInt(i.netMinor) * previous) / quantity +
          (BigInt(i.taxMinor) * (previous + q)) / quantity -
          (BigInt(i.taxMinor) * previous) / quantity,
      )
    );
  }, 0);
  return (
    <section className="pos-panel">
      <h3>{payment ? `${payment.provider} refund` : "Cash refund"}</h3>
      {payment?.metadata.refundRequiresCardPresence && <p>Square requires the original card for this refund. Ask the customer to present it on {payment.metadata.terminalName ?? "the original Terminal"}, then check refund status.</p>}
      {refundResult?.status === "FAILED" && (
        <button
          disabled={providerBusy}
          onClick={() => {
            localStorage.removeItem(refundKey);
            setSavedRefund(null);
            setRefundResult(null);
          }}
        >
          Dismiss failed refund
        </button>
      )}
      {payment?.provider === "EXTERNAL" && (
        <p>
          Record money already refunded outside Trading Docks. This does not
          issue or verify a processor refund.
        </p>
      )}
      {providerError && <p role="alert">{providerError}</p>}
      {savedRefund && (
        <p>
          Refund {refundResult?.status ?? "status is being verified"}.{" "}
          <button disabled={providerBusy} onClick={() => void providerRefund()}>
            Check Refund Status
          </button>
        </p>
      )}
      <p>
        Choose quantities and explicitly decide whether each item returns to
        inventory. If condition changed, choose Do Not Return and use the
        existing inventory review process.
      </p>
      <OperationNotice
        operation={operation}
        onRecovered={() => window.location.reload()}
      />
      {complete ? (
        <p role="status">
          Refund recorded.{" "}
          <button onClick={() => window.location.reload()}>
            Refresh transaction
          </button>
        </p>
      ) : (
        <>
          <label>
            Processing drawer
            <select
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
            >
              <option value="">Choose open drawer</option>
              {data.sessions
                .filter((s) => s.status === "OPEN")
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {data.sites.find((l) => l.id === s.site_id)?.name} ·{" "}
                    {data.registers.find((r) => r.id === s.register_id)?.name}
                  </option>
                ))}
            </select>
          </label>
          {items.map((i) => (
            <div className="pos-form-grid" key={i.id}>
              <label>
                {i.name} · {i.quantity - i.refundedQuantity} refundable
                <input
                  type="number"
                  min="0"
                  max={i.quantity - i.refundedQuantity}
                  value={quantities[i.id] ?? 0}
                  disabled={operation.locked}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (
                      Number.isInteger(n) &&
                      n >= 0 &&
                      n <= i.quantity - i.refundedQuantity
                    )
                      setQuantities((q) => ({ ...q, [i.id]: n }));
                  }}
                />
              </label>
              <label>
                Inventory decision
                <select
                  value={
                    restore[i.id] === undefined ? "" : String(restore[i.id])
                  }
                  disabled={operation.locked}
                  onChange={(e) =>
                    setRestore((r) => ({
                      ...r,
                      [i.id]: e.target.value === "true",
                    }))
                  }
                >
                  <option value="" disabled>
                    Choose return decision
                  </option>
                  <option value="true">
                    Return to Inventory — unchanged condition
                  </option>
                  <option value="false">Do Not Return</option>
                </select>
              </label>
            </div>
          ))}
          <label>
            Return reason
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {[
                "Customer return",
                "Returned unopened",
                "Damaged",
                "Wrong item",
                "Other",
              ].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label>
            Notes
            <input
              maxLength={400}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <p>
            {payment ? "Refund via original payment" : "Return cash"}{" "}
            <strong>{money(total)}</strong>
          </p>
          <button
            disabled={
              !paymentLoaded ||
              providerBusy ||
              !!savedRefund ||
              operation.locked ||
              !sessionId ||
              !items.some((i) => (quantities[i.id] ?? 0) > 0) ||
              items.some(
                (i) =>
                  (quantities[i.id] ?? 0) > 0 && restore[i.id] === undefined,
              )
            }
            onClick={async () => {
              const payload = {
                saleId,
                sessionId,
                expectedMinor: total,
                reason: `${category}: ${reason}`,
                lines: items
                  .filter((i) => (quantities[i.id] ?? 0) > 0)
                  .map((i) => ({
                    saleItemId: i.id,
                    quantity: quantities[i.id],
                    returnInventory: restore[i.id],
                  })),
              };
              if (payment) await providerRefund(payload);
              else if (await operation.run("refund", payload))
                setComplete(true);
            }}
          >
            {payment?.provider === "EXTERNAL"
              ? "Record external refund"
              : payment
                ? "Request provider refund"
                : "Record cash refund"}
          </button>
        </>
      )}
    </section>
  );
}
