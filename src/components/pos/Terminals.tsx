"use client";
import { useEffect, useState } from "react";
import { paymentRequest } from "@/lib/pos/payments/client";
export type TerminalDevice = {
  id: string;
  siteId: string;
  registerId?: string;
  name: string;
  pairingStatus: string;
  status: string;
  pairBy?: string;
  pairedAt?: string;
  lastSeenAt?: string;
  eligible: boolean;
};
type HardwareData = {
  devices: TerminalDevice[];
  canManage: boolean;
  sites: { id: string; name: string }[];
  registers: { id: string; siteId: string; name: string }[];
  pairing?: { id?: string; code?: string; pairBy?: string };
};
export function Terminals() {
  const [data, setData] = useState<HardwareData | null>(null),
    [name, setName] = useState("Front Terminal"),
    [site, setSite] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [now, setNow] = useState(() => Date.now());
  const [pairKey, setPairKey] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    paymentRequest<HardwareData>("/terminals")
      .then((v) => {
        if (active) {
          setData(v);
          setSite(v.sites[0]?.id ?? "");
        }
      })
      .catch(() => {
        if (active) setError("Terminal setup is unavailable.");
      });
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      setData(await paymentRequest<HardwareData>("/terminals", body));
      if (body.action === "pair") setPairKey(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check Terminal setup.");
    } finally {
      setBusy(false);
    }
  }
  const pairing = data?.pairing;
  useEffect(() => {
    if (!pairing?.id || !pairing.code) return;
    const timer = setInterval(() => {
      if (!document.hidden)
        void paymentRequest<HardwareData>("/terminals", {
          action: "check",
          id: pairing.id,
        })
          .then(setData)
          .catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [pairing?.id, pairing?.code]);
  const remaining = pairing?.pairBy
    ? Math.max(0, Math.ceil((Date.parse(pairing.pairBy) - now) / 1000))
    : 0;
  return (
    <section className="pos-panel pos-terminals" aria-label="Payment Terminals">
      <h2>Payment Terminals</h2>
      <p>
        Square Sandbox · No real money. Physical Terminal acceptance is pending.
      </p>
      <a href="/dashboard/pos/payments">Connect Square / Enable Terminal</a>
      {error && <p role="alert">{error}</p>}
      {data?.devices.map((d) => (
        <article className="pos-panel" key={d.id}>
          <h3>{d.name}</h3>
          <p>
            Square · {data.sites.find((s) => s.id === d.siteId)?.name} ·{" "}
            {data.registers.find((r) => r.id === d.registerId)?.name ??
              "Unassigned"}
          </p>
          <p role="status">
            {d.status} · Pairing: {d.pairingStatus}
          </p>
          <p>
            Last seen:{" "}
            {d.lastSeenAt
              ? new Date(d.lastSeenAt).toLocaleString()
              : "Not yet confirmed online"}
          </p>
          {d.pairingStatus === "EXPIRED" && (
            <p>This pairing code expired. Generate a new code below.</p>
          )}
          {data.canManage && (
            <>
              <button
                disabled={busy}
                onClick={() => void act({ action: "check", id: d.id })}
              >
                Check Terminal
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  const value = window.prompt("Terminal name", d.name);
                  if (value?.trim())
                    void act({
                      action: "rename",
                      id: d.id,
                      name: value.trim(),
                    });
                }}
              >
                Rename
              </button>
              <label>
                Assigned register
                <select
                  aria-label={`Register for ${d.name}`}
                  disabled={
                    busy ||
                    d.status === "DISABLED" ||
                    d.pairingStatus !== "PAIRED"
                  }
                  value={d.registerId ?? ""}
                  onChange={(e) =>
                    void act({
                      action: "assign",
                      id: d.id,
                      registerId: e.target.value,
                    })
                  }
                >
                  <option value="">Unassigned</option>
                  {data.registers
                    .filter((r) => r.siteId === d.siteId)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </select>
              </label>
              <button
                disabled={busy || d.status === "DISABLED"}
                onClick={() => {
                  if (
                    window.confirm(
                      `Disable ${d.name} in Trading Docks? Existing payments will still be reconciled.`,
                    )
                  )
                    void act({ action: "disable", id: d.id });
                }}
              >
                Disable
              </button>
            </>
          )}
        </article>
      ))}
      {pairing?.code && (
        <div role="status">
          <h3>Pair Square Terminal</h3>
          {remaining > 0 ? (
            <>
              <strong style={{ fontSize: "2rem", letterSpacing: ".15em" }}>
                {pairing.code}
              </strong>
              <p>
                Code expires in {Math.floor(remaining / 60)}:
                {String(remaining % 60).padStart(2, "0")}
              </p>
              <ol>
                <li>Power on Square Terminal.</li>
                <li>Follow Square’s Terminal API pairing/sign-in flow.</li>
                <li>Enter the code.</li>
                <li>Keep this screen open until pairing is confirmed.</li>
              </ol>
              <p>
                Sandbox does not connect physical hardware; these steps require
                a separately approved hardware acceptance environment.
              </p>
            </>
          ) : (
            <p>This pairing code expired.</p>
          )}
        </div>
      )}
      {data?.canManage && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const id = pairKey ?? crypto.randomUUID();
            setPairKey(id);
            void act({ action: "pair", id, name, siteId: site });
          }}
        >
          <label>
            Terminal name
            <input
              maxLength={128}
              required
              value={name}
              disabled={busy || !!pairKey}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Store location
            <select
              aria-label="Store location"
              value={site}
              disabled={busy || !!pairKey}
              onChange={(e) => setSite(e.target.value)}
            >
              {data.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button disabled={busy || !site}>
            {pairKey
              ? "Retry pairing request"
              : data.devices.some((d) => d.pairingStatus === "EXPIRED")
                ? "Generate New Code"
                : "Add Square Terminal"}
          </button>
        </form>
      )}
      <p>
        Disable and unassign affect Trading Docks only; they do not unpair
        Square hardware.
      </p>
    </section>
  );
}
