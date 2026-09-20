"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { money, parseMinor, type Bootstrap } from "@/lib/pos/domain";
import { posRead } from "@/lib/pos/client";
import { OperationNotice, useOperationalCommand } from "./OperationalCommand";

type Session = {
  opened_by_name: string;
  closed_by_name: string;
  latest_operator: string;
  id: string;
  register_id: string;
  site_id: string;
  register_name: string;
  site_name: string;
  timezone: string;
  status: string;
  opened_at: string;
  closed_at: string | null;
  opening_minor: number | null;
  expected_minor: number | null;
  counted_minor: number | null;
  variance_minor: number | null;
  close_notes: string;
};
type Approval = {
  id: string;
  action: string;
  requested_by: string;
  requestedByName: string;
  reason: string;
  intent: Record<string, unknown>;
  summary: {
    expectedMinor?: number;
    registerName?: string;
    lines?: {
      name: string;
      quantity: number;
      originalUnitPriceMinor: number;
      unitPriceMinor: number;
      discountMinor: number;
      lineTotalMinor: number;
    }[];
  };
  approvedBy: string | null;
};
type SessionDetail = {
  approvals: {
    action: string;
    reason: string;
    approvedAt: string;
    name: string;
  }[];
  events: {
    id: string;
    created_at: string;
    kind: string;
    amount_minor: number;
    reason: string;
  }[];
  sales: { id: string; number: string; totalMinor: number }[];
  refunds: { id: string; total_minor: number; reason: string }[];
};
type Access = {
  joinableSites?: { id: string; name: string }[];
  employees: {
    id: string;
    name: string;
    permissions: Record<string, boolean>;
  }[];
  grants: {
    id: string;
    site_id: string;
    employee_id: string;
    capabilities: string[];
    granted_at: string;
    revoked_at: string | null;
  }[];
};
type Daily = {
  date: string;
  timezone: string;
  sales: {
    grossMinor: number;
    discountMinor: number;
    netMinor: number;
    taxMinor: number;
    totalMinor: number;
    count: number;
    averageMinor: number;
  };
  refunds: {
    netMinor: number;
    taxMinor: number;
    totalMinor: number;
    count: number;
  };
  byRegister: { name: string; count: number; total_minor: number }[];
  byEmployee: {
    name: string;
    count: number;
    total_minor: number;
    discount_minor: number;
    average_minor: number;
    refund_count: number;
    refund_minor: number;
    override_count: number;
    session_count: number;
    variance_minor: number;
  }[];
  byHour: { hour: number; count: number; total_minor: number }[];
  cash: { kind: string; amount_minor: number; count: number }[];
  sessions: {
    id: string;
    status: string;
    expectedMinor: number;
    varianceMinor: number | null;
  }[];
};

export function Operations({
  data,
  scope,
  mode,
}: {
  data: Bootstrap;
  scope: string;
  mode: "registers" | "staff" | "daily";
}) {
  const operation = useOperationalCommand(`${scope}.${mode}`);
  const [siteId, setSiteId] = useState(data.sites[0]?.id ?? "");
  const site = data.sites.find((s) => s.id === siteId);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [access, setAccess] = useState<Access>({ employees: [], grants: [] });
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [daily, setDaily] = useState<Daily | null>(null);
  const [date, setDate] = useState("");
  const [varianceOnly, setVarianceOnly] = useState(false);
  const [registerId, setRegisterId] = useState(data.registers[0]?.id ?? "");
  const [name, setName] = useState("");
  const [kind, setKind] = useState("PAID_IN");
  const [amount, setAmount] = useState("");
  const [reasonType, setReasonType] = useState("OTHER");
  const [reason, setReason] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [allowReturn, setAllowReturn] = useState(false);
  const [joinSite, setJoinSite] = useState("");
  const [joinStorage, setJoinStorage] = useState("");
  const [sellPermission, setSellPermission] = useState(false);
  const [refundPermission, setRefundPermission] = useState(false);
  const [cashPermission, setCashPermission] = useState(false);
  const [timezone, setTimezone] = useState(site?.timezone ?? "America/Phoenix");
  const [noteThreshold, setNoteThreshold] = useState(
    String(Number(site?.settings?.noteThresholdMinor ?? 0) / 100),
  );
  const [approvalThreshold, setApprovalThreshold] = useState(
    String(Number(site?.settings?.approvalThresholdMinor ?? 2000) / 100),
  );
  const [blind, setBlind] = useState(Boolean(site?.settings?.blindClose));
  const [width, setWidth] = useState(
    String(site?.settings?.receiptWidth ?? "80"),
  );
  const [address, setAddress] = useState(String(site?.settings?.address ?? ""));
  const [footer, setFooter] = useState(
    String(site?.settings?.footer ?? "Thank you for shopping with us."),
  );
  const [policy, setPolicy] = useState(
    String(site?.settings?.returnPolicy ?? ""),
  );
  const [error, setError] = useState("");
  const [cashApprovalId, setCashApprovalId] = useState<string | undefined>();
  const [receiptOptions, setReceiptOptions] = useState({
    showEmployee: site?.settings?.showEmployee !== false,
    showSku: site?.settings?.showSku !== false,
    showLocation: site?.settings?.showLocation !== false,
  });
  const requestVersion = useRef(0);
  const refresh = useCallback(async () => {
    if (!siteId && mode !== "staff") return;
    const version = ++requestVersion.current;
    try {
      if (mode === "staff") {
        const value = await posRead<Access>("access");
        if (version === requestVersion.current) setAccess(value);
      } else if (mode === "daily") {
        const value = await posRead<Daily>("daily", { siteId, date });
        if (version === requestVersion.current) setDaily(value);
      } else {
        const [rows, requests] = await Promise.all([
          posRead<Session[]>("sessions", {
            siteId,
            varianceOnly: String(varianceOnly),
          }),
          data.canManage
            ? posRead<Approval[]>("approvals", { siteId })
            : Promise.resolve([]),
        ]);
        if (version === requestVersion.current) {
          setSessions(rows);
          setApprovals(requests);
        }
      }
      if (version === requestVersion.current) setError("");
    } catch (err) {
      if (version === requestVersion.current)
        setError(
          err instanceof Error ? err.message : "Operations unavailable.",
        );
    }
  }, [siteId, mode, date, varianceOnly, data.canManage]);
  useEffect(() => {
    const requestState = requestVersion;
    let active = true;
    queueMicrotask(() => {
      if (active) void refresh();
    });
    return () => {
      active = false;
      ++requestState.current;
    };
  }, [refresh]);
  const current = sessions.find(
    (s) => s.register_id === registerId && s.status !== "CLOSED",
  );
  async function mutate(action: string, body: Record<string, unknown>) {
    const result = await operation.run(action, body);
    if (result) {
      setReason("");
      setAmount("");
      await refresh();
    }
  }
  function chooseSite(id: string) {
    setSiteId(id);
    setDetail(null);
    setRegisterId(data.registers.find((r) => r.site_id === id)?.id ?? "");
    const options = data.sites.find((s) => s.id === id)?.settings;
    setReceiptOptions({
      showEmployee: options?.showEmployee !== false,
      showSku: options?.showSku !== false,
      showLocation: options?.showLocation !== false,
    });
    const s = data.sites.find((s) => s.id === id);
    setTimezone(s?.timezone ?? "America/Phoenix");
    setNoteThreshold(
      String(Number(s?.settings?.noteThresholdMinor ?? 0) / 100),
    );
    setApprovalThreshold(
      String(Number(s?.settings?.approvalThresholdMinor ?? 2000) / 100),
    );
    setBlind(Boolean(s?.settings?.blindClose));
    setWidth(String(s?.settings?.receiptWidth ?? "80"));
    setAddress(String(s?.settings?.address ?? ""));
    setFooter(String(s?.settings?.footer ?? ""));
    setPolicy(String(s?.settings?.returnPolicy ?? ""));
  }
  return (
    <>
      <h2>
        {mode === "staff"
          ? "Staff access & store settings"
          : mode === "daily"
            ? "Daily operations"
            : "Registers & cash management"}
      </h2>
      <div className="pos-toolbar">
        <label>
          Store
          <select
            value={siteId}
            disabled={operation.locked}
            onChange={(e) => chooseSite(e.target.value)}
          >
            {data.sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => void refresh()}>Refresh</button>
        {mode === "daily" && (
          <label>
            Business date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      <OperationNotice
        operation={operation}
        onRecovered={() => void refresh()}
      />
      {mode === "registers" && (
        <>
          <div className="pos-toolbar">
            <label>
              <input
                type="checkbox"
                checked={varianceOnly}
                onChange={(e) => setVarianceOnly(e.target.checked)}
              />{" "}
              Only sessions with variance
            </label>
            <Link href="/dashboard/pos">Open register / count drawer</Link>
          </div>
          <div className="pos-history">
            {sessions.map((s) => (
              <article key={s.id} className="pos-session">
                <h3>
                  {s.register_name} · {s.status}
                </h3>
                <p>
                  Opened by {s.opened_by_name} · Latest operator{" "}
                  {s.latest_operator}
                </p>
                {s.closed_at && (
                  <p>
                    Closed by {s.closed_by_name} ·{" "}
                    {new Date(s.closed_at).toLocaleString("en-US", {
                      timeZone: s.timezone,
                    })}
                  </p>
                )}
                <p>
                  {new Date(s.opened_at).toLocaleString("en-US", {
                    timeZone: s.timezone,
                  })}{" "}
                  · {s.timezone}
                </p>
                <p>
                  Opening{" "}
                  {s.opening_minor === null
                    ? "Hidden"
                    : money(Number(s.opening_minor))}{" "}
                  · Expected{" "}
                  {s.expected_minor === null
                    ? "Hidden"
                    : money(Number(s.expected_minor))}
                </p>
                {s.counted_minor !== null && (
                  <p>
                    Counted {money(Number(s.counted_minor))} ·{" "}
                    {money(Math.abs(Number(s.variance_minor)))}{" "}
                    {Number(s.variance_minor) < 0 ? "Short" : "Over"}
                  </p>
                )}
                {s.close_notes && <p>{s.close_notes}</p>}
                {data.canManage && (
                  <button
                    onClick={async () => {
                      try {
                        setDetail(
                          await posRead<SessionDetail>("session_detail", {
                            siteId: s.site_id,
                            sessionId: s.id,
                          }),
                        );
                      } catch (err) {
                        setError(String(err));
                      }
                    }}
                  >
                    View activity
                  </button>
                )}
                {s.status === "CLOSING" && data.canManage && (
                  <button
                    disabled={operation.locked}
                    onClick={() =>
                      void mutate("resume", {
                        registerId: s.register_id,
                        sessionId: s.id,
                      })
                    }
                  >
                    Resume session
                  </button>
                )}
              </article>
            ))}
          </div>
          {detail && (
            <section className="pos-panel">
              <h3>Session activity</h3>
              {detail.approvals.map((a, i) => (
                <p key={i}>
                  Approved {a.action} by {a.name} · {a.reason}
                </p>
              ))}
              {detail.events.map((e) => (
                <p key={e.id}>
                  {new Date(e.created_at).toLocaleTimeString("en-US", {
                    timeZone: site?.timezone,
                  })}{" "}
                  · {e.kind.replaceAll("_", " ")} ·{" "}
                  {money(Number(e.amount_minor))} · {e.reason}
                </p>
              ))}
              {detail.sales.map((s) => (
                <p key={s.id}>
                  <Link href={`/dashboard/pos/transactions/${s.id}`}>
                    {s.number}
                  </Link>{" "}
                  · {money(Number(s.totalMinor))}
                </p>
              ))}
              {detail.refunds.map((r) => (
                <p key={r.id}>
                  Refund {money(Number(r.total_minor))} · {r.reason}
                </p>
              ))}
            </section>
          )}
          <section className="pos-panel">
            <h3>Record cash movement</h3>
            <p>
              Every movement requires a reason. Cash drops represent money moved
              to the safe.
            </p>
            <div className="pos-form-grid">
              <label>
                Register
                <select
                  aria-label="Register"
                  value={registerId}
                  onChange={(e) => setRegisterId(e.target.value)}
                >
                  {data.registers
                    .filter((r) => r.site_id === siteId)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Movement
                <select value={kind} onChange={(e) => setKind(e.target.value)}>
                  {["PAID_IN", "PAID_OUT", "CASH_DROP", "CASH_ADJUSTMENT"].map(
                    (k) => (
                      <option key={k}>{k}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Amount
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <label>
                Reason category
                <select
                  value={reasonType}
                  onChange={(e) => setReasonType(e.target.value)}
                >
                  {[
                    "CHANGE_FLOAT",
                    "PETTY_CASH",
                    "COURIER",
                    "SAFE",
                    "CORRECTION",
                    "OTHER",
                  ].map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </label>
              <label>
                Reason
                <input
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            </div>
            <button
              disabled={
                operation.locked ||
                !current ||
                current.status !== "OPEN" ||
                !reason ||
                parseMinor(amount.replace(/^-/, "")) === null
              }
              onClick={() =>
                void mutate("cash_event", {
                  registerId,
                  sessionId: current?.id,
                  kind,
                  amountMinor:
                    (parseMinor(amount.replace(/^-/, "")) ?? 0) *
                    (amount.startsWith("-") ? -1 : 1),
                  reasonType,
                  reason,
                  ...(cashApprovalId ? { approvalId: cashApprovalId } : {}),
                })
              }
            >
              Record movement
            </button>
            {kind === "CASH_ADJUSTMENT" && (
              <button
                disabled={
                  operation.locked ||
                  !current ||
                  !reason ||
                  parseMinor(amount.replace(/^-/, "")) === null
                }
                onClick={async () => {
                  const intent = {
                    registerId,
                    sessionId: current?.id,
                    kind,
                    amountMinor:
                      (parseMinor(amount.replace(/^-/, "")) ?? 0) *
                      (amount.startsWith("-") ? -1 : 1),
                    reasonType,
                    reason,
                  };
                  const request = await operation.run<{ id: string }>(
                    "request_approval",
                    { siteId, operation: "cash_event", intent, reason },
                  );
                  if (request) {
                    setCashApprovalId(request.id);
                    operation.setMessage(
                      "Request sent to managers. After approval, record this exact adjustment.",
                    );
                  }
                }}
              >
                Request adjustment approval
              </button>
            )}
          </section>
          {data.canManage && (
            <>
              <section className="pos-panel">
                <h3>Configure registers</h3>
                <label>
                  New register name
                  <input
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <button
                  disabled={operation.locked || !name}
                  onClick={async () => {
                    if (
                      await operation.run("configure_register", {
                        siteId,
                        name,
                      })
                    )
                      window.location.reload();
                  }}
                >
                  Create register
                </button>
                {data.registers
                  .filter((r) => r.site_id === siteId)
                  .map((r) => (
                    <p key={r.id}>
                      {r.name}{" "}
                      <button
                        disabled={operation.locked}
                        onClick={async () => {
                          if (
                            await operation.run("configure_register", {
                              siteId,
                              id: r.id,
                              name: r.name,
                              active: r.active === false,
                            })
                          )
                            window.location.reload();
                        }}
                      >
                        {r.active === false ? "Activate" : "Deactivate"}
                      </button>
                    </p>
                  ))}
              </section>
              <section className="pos-panel">
                <h3>Manager approvals</h3>
                <p>
                  Approval records your signed-in identity and applies only to
                  the displayed request.
                </p>
                {approvals.map((r) => (
                  <article className="pos-session" key={r.id}>
                    <strong>
                      {r.action} · {r.reason}
                    </strong>
                    <p>Requested by {r.requestedByName}</p>
                    <p>
                      Amount{" "}
                      {money(
                        Number(
                          r.intent.expectedMinor ??
                            r.intent.countedMinor ??
                            r.intent.amountMinor ??
                            0,
                        ),
                      )}
                    </p>
                    <details>
                      <summary>Review requested changes</summary>
                      {r.summary.lines?.map((line, index) => (
                        <p key={index}>
                          <strong>{line.name}</strong> · {line.quantity} copies
                          · Original{" "}
                          {money(Number(line.originalUnitPriceMinor))} · Unit
                          price {money(Number(line.unitPriceMinor))} · Discount{" "}
                          {money(Number(line.discountMinor))} · Line total{" "}
                          {money(Number(line.lineTotalMinor))}
                        </p>
                      ))}
                      {r.summary.expectedMinor !== undefined && (
                        <p>
                          {r.summary.registerName} · Expected cash{" "}
                          {money(Number(r.summary.expectedMinor))}
                        </p>
                      )}
                      <p>
                        {String(
                          r.intent.discountReason ??
                            r.intent.reason ??
                            r.reason,
                        )}
                      </p>
                      <p>
                        Cart discount:{" "}
                        {money(Number(r.intent.cartDiscountMinor ?? 0))} /{" "}
                        {Number(r.intent.cartDiscountBps ?? 0) / 100}%
                      </p>
                      {(Array.isArray(r.intent.lines)
                        ? (r.intent.lines as Record<string, unknown>[])
                        : []
                      ).map((line, index) => (
                        <p key={index}>
                          Item {index + 1}: {Number(line.quantity)} copies ·
                          Discount {money(Number(line.discountMinor ?? 0))} /{" "}
                          {Number(line.discountBps ?? 0) / 100}%
                          {line.overrideMinor !== undefined
                            ? ` · Unit price override ${money(Number(line.overrideMinor))}`
                            : ""}
                        </p>
                      ))}
                    </details>
                    {r.approvedBy ? (
                      <p>Approved</p>
                    ) : (
                      <button
                        disabled={operation.locked}
                        onClick={() =>
                          void mutate("approve", { siteId, id: r.id })
                        }
                      >
                        Approve this request
                      </button>
                    )}
                  </article>
                ))}
              </section>
            </>
          )}
        </>
      )}
      {mode === "staff" && (
        <>
          <section className="pos-panel">
            <h3>Add your inventory to an existing store</h3>
            <p>
              Business partners can connect their own storage to the same store
              while retaining ownership.
            </p>
            <label>
              Existing store
              <select
                value={joinSite}
                onChange={(e) => setJoinSite(e.target.value)}
              >
                <option value="">Choose store</option>
                {access.joinableSites?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Your unmapped storage
              <select
                value={joinStorage}
                onChange={(e) => setJoinStorage(e.target.value)}
              >
                <option value="">Choose storage</option>
                {data.locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={operation.locked || !joinSite || !joinStorage}
              onClick={async () => {
                if (
                  await operation.run("join_site", {
                    siteId: joinSite,
                    locationId: joinStorage,
                  })
                )
                  window.location.reload();
              }}
            >
              Connect my storage
            </button>
          </section>
          <section className="pos-panel">
            <h3>Owner-granted inventory access</h3>
            <p>
              These grants authorize use of your stock at this store. Staff
              permissions are configured separately.
            </p>
            <label>
              Employee
              <select
                value={employeeId}
                onChange={(e) => {
                  setEmployeeId(e.target.value);
                  const p = access.employees.find(
                    (x) => x.id === e.target.value,
                  )?.permissions;
                  setSellPermission(Boolean(p?.["pos.sell"]));
                  setRefundPermission(Boolean(p?.["pos.refund"]));
                  setCashPermission(Boolean(p?.["pos.cash"]));
                }}
              >
                <option value="">Choose employee</option>
                {access.employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={allowReturn}
                onChange={(e) => setAllowReturn(e.target.checked)}
              />{" "}
              Also delegate returns
            </label>
            <button
              disabled={operation.locked || !employeeId}
              onClick={() =>
                void mutate("grant", {
                  siteId,
                  employeeId,
                  capabilities: allowReturn ? ["sell", "return"] : ["sell"],
                })
              }
            >
              Grant / update scope
            </button>
            {access.grants
              .filter((g) => g.site_id === siteId)
              .map((g) => (
                <p key={g.id}>
                  {access.employees.find((e) => e.id === g.employee_id)?.name ??
                    "Former employee"}{" "}
                  · {g.capabilities.join(", ")} ·{" "}
                  {g.revoked_at ? "Revoked" : "Active"}{" "}
                  {!g.revoked_at && (
                    <button
                      disabled={operation.locked}
                      onClick={() => void mutate("revoke", { id: g.id })}
                    >
                      Revoke
                    </button>
                  )}
                </p>
              ))}
          </section>
          <section className="pos-panel">
            <h3>Employee POS permissions</h3>
            <p>
              Workspace owners and admins can configure permissions. Permissions
              alone do not grant another owner’s inventory.
            </p>
            <label>
              <input
                type="checkbox"
                checked={sellPermission}
                onChange={(e) => setSellPermission(e.target.checked)}
              />{" "}
              Checkout
            </label>
            <label>
              <input
                type="checkbox"
                checked={refundPermission}
                onChange={(e) => setRefundPermission(e.target.checked)}
              />{" "}
              Refunds
            </label>
            <label>
              <input
                type="checkbox"
                checked={cashPermission}
                onChange={(e) => setCashPermission(e.target.checked)}
              />{" "}
              Cash movements
            </label>
            <button
              disabled={operation.locked || !employeeId}
              onClick={() =>
                void mutate("staff_permissions", {
                  employeeId,
                  permissions: {
                    "pos.sell": sellPermission,
                    "pos.refund": refundPermission,
                    "pos.cash": cashPermission,
                  },
                })
              }
            >
              Save staff permissions
            </button>
          </section>
          <section className="pos-panel">
            <h3>Store & receipt settings</h3>
            <div className="pos-form-grid">
              <label>
                IANA timezone
                <input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                />
              </label>
              <label>
                Variance note required above
                <input
                  inputMode="decimal"
                  value={noteThreshold}
                  onChange={(e) => setNoteThreshold(e.target.value)}
                />
              </label>
              <label>
                Manager approval above
                <input
                  inputMode="decimal"
                  value={approvalThreshold}
                  onChange={(e) => setApprovalThreshold(e.target.value)}
                />
              </label>
              <label>
                Receipt paper
                <select
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                >
                  <option>80</option>
                  <option>58</option>
                  <option>Letter</option>
                </select>
              </label>
              <label>
                Store address
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </label>
              <label>
                Receipt footer
                <textarea
                  value={footer}
                  onChange={(e) => setFooter(e.target.value)}
                />
              </label>
              <label>
                Return policy
                <textarea
                  value={policy}
                  onChange={(e) => setPolicy(e.target.value)}
                />
              </label>
            </div>
            {(["showEmployee", "showSku", "showLocation"] as const).map(
              (key) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={receiptOptions[key]}
                    onChange={(e) =>
                      setReceiptOptions((o) => ({
                        ...o,
                        [key]: e.target.checked,
                      }))
                    }
                  />
                  {key === "showEmployee"
                    ? "Show employee on receipt"
                    : key === "showSku"
                      ? "Show SKU on receipt"
                      : "Show register on receipt"}
                </label>
              ),
            )}
            <label>
              <input
                type="checkbox"
                checked={blind}
                onChange={(e) => setBlind(e.target.checked)}
              />{" "}
              Hide expected drawer cash from cashiers
            </label>
            <button
              disabled={
                operation.locked ||
                parseMinor(noteThreshold) === null ||
                parseMinor(approvalThreshold) === null
              }
              onClick={() =>
                void mutate("settings", {
                  siteId,
                  timezone,
                  settings: {
                    ...site?.settings,
                    ...receiptOptions,
                    noteThresholdMinor: parseMinor(noteThreshold),
                    approvalThresholdMinor: parseMinor(approvalThreshold),
                    blindClose: blind,
                    receiptWidth: width,
                    address,
                    footer,
                    returnPolicy: policy,
                  },
                })
              }
            >
              Save store settings
            </button>
          </section>
        </>
      )}
      {mode === "daily" && daily && (
        <>
          <p>
            {daily.date} · {daily.timezone} · Calendar-day report
          </p>
          <div className="pos-report-grid">
            {Object.entries({
              "Gross sales": daily.sales.grossMinor,
              Discounts: daily.sales.discountMinor,
              Refunds: daily.refunds.totalMinor,
              "Net sales after returns":
                Number(daily.sales.netMinor) - Number(daily.refunds.netMinor),
              "Net tax":
                Number(daily.sales.taxMinor) - Number(daily.refunds.taxMinor),
              "Net cash sales":
                Number(daily.sales.totalMinor) -
                Number(daily.refunds.totalMinor),
              "Average sale": daily.sales.averageMinor,
            }).map(([label, value]) => (
              <div className="pos-panel" key={label}>
                <span>{label}</span>
                <strong>{money(Number(value))}</strong>
              </div>
            ))}
          </div>
          <p>
            {daily.sales.count} sales · {daily.refunds.count} refunds · Noncash:{" "}
            {money(0)}
          </p>
          <section className="pos-panel">
            <h3>By register</h3>
            {daily.byRegister.map((r) => (
              <p key={r.name}>
                {r.name} · {r.count} sales · {money(Number(r.total_minor))}
              </p>
            ))}
          </section>
          <section className="pos-panel">
            <h3>By employee</h3>
            {daily.byEmployee.map((e, i) => (
              <p key={i}>
                {e.name} · {e.count} sales · {money(Number(e.total_minor))} ·
                Discounts {money(Number(e.discount_minor))} · Average{" "}
                {money(Number(e.average_minor))} · {e.refund_count} refunds (
                {money(Number(e.refund_minor))}) · {e.override_count} price
                overrides · {e.session_count} sales sessions · Closing variance{" "}
                {money(Number(e.variance_minor))}
              </p>
            ))}
          </section>
          <section className="pos-panel">
            <h3>By store-local hour</h3>
            {daily.byHour.map((h) => (
              <p key={h.hour}>
                {h.hour}:00 · {h.count} sales · {money(Number(h.total_minor))}
              </p>
            ))}
          </section>
          <section className="pos-panel">
            <h3>Cash activity</h3>
            {daily.cash.map((c) => (
              <p key={c.kind}>
                {c.kind.replaceAll("_", " ")} · {c.count} events ·{" "}
                {money(Number(c.amount_minor))}
              </p>
            ))}
          </section>
          <section className="pos-panel">
            <h3>Drawer expectations & variance</h3>
            {daily.sessions.map((s) => (
              <p key={s.id}>
                {s.status} · Expected {money(Number(s.expectedMinor))} ·{" "}
                {s.varianceMinor === null
                  ? "Not counted"
                  : `${money(Math.abs(Number(s.varianceMinor)))} ${Number(s.varianceMinor) < 0 ? "Short" : "Over"}`}
              </p>
            ))}
          </section>
        </>
      )}
    </>
  );
}
