"use client";
import { useEffect, useRef, useState } from "react";
import { posWrite } from "@/lib/pos/client";
import { paymentRequest } from "@/lib/pos/payments/client";
import {
  mockOutcomes,
  payableAgain,
  type Payment,
} from "@/lib/pos/payments/domain";
import { money } from "@/lib/pos/domain";
import type { TerminalDevice } from "./Terminals";
export function PaymentPanel({
  scope,
  siteId,
  registerId,
  disabled,
  intent,
  onLock,
  onComplete,
  onMethod,
}: {
  scope: string;
  siteId?: string;
  registerId?: string;
  disabled: boolean;
  intent: () => Record<string, unknown>;
  onLock: (locked: boolean) => void;
  onComplete: (payment: Payment) => void;
  onMethod: (provider: string) => void;
}) {
  const key = `td.pos.payment.${scope}`;
  const [ready, setReady] = useState(false);
  const [mock, setMock] = useState(false);
  const [squareSites, setSquareSites] = useState<string[]>([]);
  const [terminals, setTerminals] = useState<TerminalDevice[]>([]);
  const [provider, setProvider] = useState("CASH");
  const [outcome, setOutcome] = useState("APPROVE");
  const [reference, setReference] = useState("");
  const [method, setMethod] = useState("external_terminal");
  const [saved, setSaved] = useState<Record<string, unknown> | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const flight = useRef(false);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const value = JSON.parse(raw);
          if (typeof value.key !== "string" || !value.intent)
            throw Error("Saved payment needs review.");
          setSaved(value);
          setProvider(
            value.method === "square_terminal"
              ? "SQUARE_TERMINAL"
              : String(value.provider),
          );
          onMethod(String(value.provider));
          onLock(true);
        } else onLock(false);
        setReady(true);
      } catch {
        setError(
          "Saved payment needs review. Check payment history before taking another payment.",
        );
        onLock(true);
      }
    });
    paymentRequest<{
      mockEnabled: boolean;
      squareSites?: string[];
      terminals?: TerminalDevice[];
    }>("/capabilities")
      .then((v) => {
        if (active) setSquareSites(v.squareSites ?? []);
        if (active) setTerminals(v.terminals ?? []);
        if (active)
          setMock(process.env.NODE_ENV !== "production" && v.mockEnabled);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [key, onLock, onMethod]);
  async function run(action: "begin" | "check" | "cancel") {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setError("");
    setErrorCode("");
    onLock(true);
    try {
      let request = saved;
      if (!request) {
        request = {
          key: crypto.randomUUID(),
          provider: provider === "SQUARE_TERMINAL" ? "SQUARE" : provider,
          outcome,
          reference,
          method: provider === "SQUARE_TERMINAL" ? "square_terminal" : method,
          intent: intent(),
        };
        localStorage.setItem(key, JSON.stringify(request));
        setSaved(request);
      }
      const result = payment?.id
        ? await paymentRequest<Payment>(
            `/${payment.id}/${action === "cancel" ? "cancel" : "check"}`,
            {},
            setError,
          )
        : await paymentRequest<Payment>("", request, setError);
      setError("");
      setPayment(result);
      if (result.saleState === "COMPLETED") {
        localStorage.removeItem(key);
        setSaved(null);
        onLock(false);
        setPayment(null);
        onComplete(result);
      }
    } catch (err) {
      setErrorCode(
        err && typeof err === "object" && "code" in err ? String(err.code) : "",
      );
      setError(
        err instanceof Error
          ? err.message
          : "Payment status is being verified.",
      );
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  const terminal = terminals.find(
    (d) => d.registerId === registerId && d.siteId === siteId && d.eligible,
  );
  // Poll at 3/6/12 seconds, pause in hidden tabs; every retry retains the persisted attempt key.
  const poll = useRef(0);
  const runner = useRef(run);
  useEffect(() => {
    runner.current = run;
  });
  useEffect(() => {
    if (
      !saved ||
      saved.method !== "square_terminal" ||
      (payment && (payableAgain(payment) || payment.status === "SUCCEEDED"))
    )
      return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      timer = setTimeout(
        async () => {
          if (stopped) return;
          if (!document.hidden) await runner.current("check");
          if (!stopped) {
            poll.current++;
            next();
          }
        },
        Math.min(12000, 3000 * 2 ** Math.min(poll.current, 2)),
      );
    };
    next();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [saved, payment]);
  return (
    <section className="pos-panel" aria-label="Payment controls">
      <label>
        Payment method
        <select
          aria-label="Payment method"
          value={provider}
          disabled={!ready || busy || !!saved || disabled}
          onChange={(e) => {
            setProvider(e.target.value);
            onMethod(e.target.value);
          }}
        >
          <option value="CASH">Cash</option>
          <option value="EXTERNAL">External — externally recorded</option>
          {mock && <option value="MOCK">Mock Card — development only</option>}
          {process.env.NODE_ENV !== "production" && terminal && (
            <option value="SQUARE_TERMINAL">
              Square Terminal — {terminal.name}
            </option>
          )}
          {process.env.NODE_ENV !== "production" &&
            squareSites.includes(siteId ?? "") && (
              <option value="SQUARE">Square Sandbox — developer test</option>
            )}
        </select>
      </label>
      {!terminal && !saved && (
        <p>
          Set up an assigned Square Terminal in{" "}
          <a href="/dashboard/pos/hardware">Hardware</a>.
        </p>
      )}
      {provider === "SQUARE" && (
        <p>
          SANDBOX — No real money is processed. This developer test uses
          Square’s Sandbox test source.
        </p>
      )}
      {provider === "MOCK" && (
        <label>
          Mock outcome
          <select
            disabled={!!saved || busy}
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
          >
            {mockOutcomes.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      )}
      {provider === "EXTERNAL" && (
        <>
          <p>
            This records money taken outside Trading Docks. No processor
            verification or charge occurs.
          </p>
          <label>
            External method
            <select
              aria-label="Mock outcome"
              disabled={!!saved || busy}
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="external_terminal">External terminal</option>
              <option value="check">Check</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            External reference
            <input
              maxLength={100}
              disabled={!!saved || busy}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {saved && errorCode === "POS_APPROVAL_REQUIRED" && (
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const cart = saved.intent as Record<string, unknown>;
              const approval = await posWrite<{ id: string }>(
                "request_approval",
                {
                  key: crypto.randomUUID(),
                  siteId: cart.siteId,
                  operation: "checkout",
                  intent: cart,
                  reason: cart.discountReason || "Payment pricing review",
                },
              );
              const next = {
                ...saved,
                intent: { ...cart, approvalId: approval.id },
              };
              localStorage.setItem(key, JSON.stringify(next));
              setSaved(next);
              setError(
                "Manager approval requested. After approval, check this payment again.",
              );
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Approval unavailable.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Request manager approval
        </button>
      )}
      {saved &&
        [
          "POS_INVALID",
          "POS_QUOTE_CHANGED",
          "POS_STOCK_UNAVAILABLE",
          "POS_PRICE_REQUIRED",
          "POS_DISCOUNT_REASON",
          "POS_MOCK_DISABLED",
          "POS_SQUARE_UNAVAILABLE",
          "POS_TERMINAL_UNAVAILABLE",
          "POS_TERMINAL_BUSY",
          "POS_TERMINAL_SCOPE",
        ].includes(errorCode) && (
          <button
            disabled={busy}
            onClick={() => {
              localStorage.removeItem(key);
              setSaved(null);
              setPayment(null);
              setError("");
              setErrorCode("");
              onLock(false);
            }}
          >
            Review rejected checkout
          </button>
        )}
      {saved ? (
        <div className="pos-terminal-wait" role="status">
          <h3>
            {payment?.saleState === "RECOVERY_REQUIRED"
              ? "Payment succeeded — sale needs review"
              : payment?.status === "DECLINED"
                ? "Payment was declined."
                : payment?.status === "CANCELED"
                  ? "Payment canceled"
                  : payment?.metadata.method === "TERMINAL" &&
                      ["AWAITING_CUSTOMER", "PROCESSING"].includes(
                        payment.status,
                      )
                    ? "Waiting for customer"
                    : "Payment status is being verified."}
          </h3>
          {payment && (
            <p>
              {payment.metadata.method === "TERMINAL"
                ? "Amount: "
                : `${payment.provider} · ${payment.status} · `}
              {money(payment.amountMinor)}
            </p>
          )}
          {payment?.metadata.method === "TERMINAL" && (
            <>
              <h3>{payment.metadata.terminalName}</h3>
              <p>Ask the customer to tap, insert, or swipe their card.</p>
              {payment.metadata.terminalError && (
                <p>
                  {payment.metadata.terminalError === "DEVICE_BUSY"
                    ? `${payment.metadata.terminalName} is already processing another transaction.`
                    : `${payment.metadata.terminalName} is unavailable. Check the device or choose another payment method.`}
                </p>
              )}
            </>
          )}
          <p>Do not take a second payment until this attempt is resolved.</p>
          <button disabled={busy} onClick={() => void run("check")}>
            Check Payment Status
          </button>
          {(provider === "MOCK" || payment?.metadata.method === "TERMINAL") &&
            payment &&
            !payableAgain(payment) && (
              <button
                disabled={busy}
                onClick={() => {
                  if (
                    provider === "MOCK" ||
                    window.confirm(
                      `Cancel the payment request on ${payment.metadata.terminalName ?? "the Terminal"}?`,
                    )
                  )
                    void run("cancel");
                }}
              >
                Cancel payment
              </button>
            )}
          {payment && payableAgain(payment) && (
            <button
              onClick={() => {
                localStorage.removeItem(key);
                setSaved(null);
                setPayment(null);
                onLock(false);
              }}
            >
              Try Another Payment Method
            </button>
          )}
          <a href="/dashboard/pos/payments">Payment history & recovery</a>
        </div>
      ) : (
        provider !== "CASH" && (
          <button
            disabled={
              !ready ||
              disabled ||
              busy ||
              (provider === "EXTERNAL" && !reference.trim())
            }
            onClick={() => void run("begin")}
          >
            {busy
              ? "Starting payment…"
              : provider === "MOCK"
                ? "Pay with Mock Card"
                : provider === "SQUARE_TERMINAL"
                  ? "Pay with Square Terminal"
                  : provider === "SQUARE"
                    ? "Run Square Sandbox payment"
                    : "Record external payment"}
          </button>
        )
      )}
    </section>
  );
}
