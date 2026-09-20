"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { money, parseMinor, type Bootstrap } from "@/lib/pos/domain";
import { OperationNotice, useOperationalCommand } from "./OperationalCommand";

export function ShiftControls({
  registerId,
  session,
  disabled,
  scope,
  onChange,
  onBusyChange,
}: {
  registerId: string;
  session?: Bootstrap["sessions"][number];
  disabled: boolean;
  scope: string;
  onChange: () => Promise<void>;
  onBusyChange: (locked: boolean) => void;
}) {
  const operation = useOperationalCommand(`${scope}.shift`);
  const [opening, setOpening] = useState("0.00");
  const [counted, setCounted] = useState("");
  const [reason, setReason] = useState("");
  const [closing, setClosing] = useState<{
    expectedMinor: number | null;
  } | null>(null);
  const [approvalId, setApprovalId] = useState<string | undefined>();
  const lock = disabled || operation.locked;
  useEffect(() => {
    onBusyChange(operation.locked);
  }, [operation.locked, onBusyChange]);
  return (
    <div className="pos-shift">
      <strong>{session?.status ?? (session ? "OPEN" : "CLOSED")}</strong>
      {!session ? (
        <>
          <label>
            Opening cash
            <input
              aria-label="Opening cash"
              inputMode="decimal"
              value={opening}
              disabled={lock}
              onChange={(e) => setOpening(e.target.value)}
            />
          </label>
          <button
            disabled={lock || parseMinor(opening) === null}
            onClick={async () => {
              if (
                await operation.run("open", {
                  registerId,
                  openingMinor: parseMinor(opening),
                })
              )
                await onChange();
            }}
          >
            Open register
          </button>
        </>
      ) : (
        <>
          {!closing ? (
            <button
              disabled={lock}
              onClick={async () => {
                const result = await operation.run<{
                  expectedMinor: number | null;
                }>("begin_close", { registerId, sessionId: session.id });
                if (result) {
                  setClosing(result);
                  await onChange();
                }
              }}
            >
              Close register
            </button>
          ) : (
            <div className="pos-close-count">
              <h3>Count drawer cash</h3>
              {closing.expectedMinor !== null && (
                <p>
                  Expected{" "}
                  <strong>{money(Number(closing.expectedMinor))}</strong>
                </p>
              )}
              <label>
                Counted cash
                <input
                  inputMode="decimal"
                  value={counted}
                  disabled={lock}
                  onChange={(e) => setCounted(e.target.value)}
                />
              </label>
              {parseMinor(counted) !== null &&
                closing.expectedMinor !== null && (
                  <p>
                    {money(
                      Math.abs(
                        parseMinor(counted)! - Number(closing.expectedMinor),
                      ),
                    )}{" "}
                    {parseMinor(counted)! < Number(closing.expectedMinor)
                      ? "Short"
                      : "Over"}
                  </p>
                )}
              <label>
                Close notes
                <input
                  maxLength={500}
                  value={reason}
                  disabled={lock}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <button
                disabled={lock || parseMinor(counted) === null}
                onClick={async () => {
                  if (
                    await operation.run("close", {
                      registerId,
                      sessionId: session.id,
                      countedMinor: parseMinor(counted),
                      reason,
                      ...(approvalId ? { approvalId } : {}),
                    })
                  ) {
                    setClosing(null);
                    setCounted("");
                    setApprovalId(undefined);
                    await onChange();
                  }
                }}
              >
                Confirm drawer close
              </button>
              <button
                disabled={lock || parseMinor(counted) === null || !reason}
                onClick={async () => {
                  const result = await operation.run<{ id: string }>(
                    "request_approval",
                    {
                      siteId: session.site_id,
                      operation: "close",
                      intent: {
                        registerId,
                        sessionId: session.id,
                        countedMinor: parseMinor(counted),
                        reason,
                      },
                      reason,
                    },
                  );
                  if (result) {
                    setApprovalId(result.id);
                    operation.setMessage(
                      "Request sent. A manager must approve this exact count from their own signed-in account. Then confirm drawer close.",
                    );
                  }
                }}
              >
                Request variance approval
              </button>
              <p>A manager can resume a closing session from Registers.</p>
            </div>
          )}
          <Link href="/dashboard/pos/registers">
            Cash movements & session history
          </Link>
        </>
      )}
      <OperationNotice
        operation={operation}
        onRecovered={() => {
          setClosing(null);
          void onChange();
        }}
      />
    </div>
  );
}
