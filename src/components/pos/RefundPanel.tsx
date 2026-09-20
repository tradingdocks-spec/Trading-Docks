"use client";
import { useState } from "react";
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
      <h3>Cash refund</h3>
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
            Return cash <strong>{money(total)}</strong>
          </p>
          <button
            disabled={
              operation.locked ||
              !sessionId ||
              !items.some((i) => (quantities[i.id] ?? 0) > 0) ||
              items.some(
                (i) =>
                  (quantities[i.id] ?? 0) > 0 && restore[i.id] === undefined,
              )
            }
            onClick={async () => {
              if (
                await operation.run("refund", {
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
                })
              )
                setComplete(true);
            }}
          >
            Record cash refund
          </button>
        </>
      )}
    </section>
  );
}
