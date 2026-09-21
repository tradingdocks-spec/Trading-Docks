"use client";
import { useEffect, useState } from "react";
import { paymentRequest } from "@/lib/pos/payments/client";
type Connection = {
  authorized_scopes?: string[];
  id: string;
  display_name: string;
  merchant_id: string;
  status: string;
  country: string;
  last_validated_at?: string;
};
type Settings = {
  configured: boolean;
  connections: Connection[];
  sites: { id: string; name: string }[];
  locations: {
    connection_id: string;
    id: string;
    name: string;
    status: string;
    address?: string;
  }[];
  mappings: { connection_id: string; site_id: string; location_id: string }[];
};
export function SquareSettings() {
  const [data, setData] = useState<Settings | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    paymentRequest<Settings>("/square")
      .then((v) => {
        if (active) setData(v);
      })
      .catch(() => {});
    queueMicrotask(() => {
      if (!active) return;
      const outcome = new URLSearchParams(window.location.search).get("square");
      setNotice(
        outcome === "denied"
          ? "Square wasn't connected. No changes were made."
          : outcome === "connected"
            ? "Square Sandbox connected."
            : outcome === "replacement"
              ? "This is a different Square merchant. Disconnect the current account before connecting the replacement. Historical payments remain tied to their original merchant."
              : outcome === "failed"
                ? "Square wasn't connected. Check configuration and try again."
                : "",
      );
    });
    return () => {
      active = false;
    };
  }, []);
  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const result = await paymentRequest<Settings & { url?: string }>(
        "/square",
        body,
      );
      if (result.url) window.location.assign(result.url);
      else setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Square needs attention.");
    } finally {
      setBusy(false);
    }
  }
  if (!data) return null;
  const connection = data.connections.find((c) =>
    ["CONNECTED", "ATTENTION"].includes(c.status),
  );
  const locations = data.locations.filter(
    (l) => l.connection_id === connection?.id,
  );
  return (
    <section className="pos-panel" aria-label="Square payment settings">
      <div className="pos-toolbar">
        <h2>Square</h2>
        <strong>SANDBOX — No real money is processed</strong>
      </div>
      {notice && <p role="status">{notice}</p>}
      <button
        disabled={busy}
        onClick={() => void act({ action: "connect", terminal: true })}
      >
        Enable Terminal — Reconnect Square
      </button>
      {data?.connections.some(
        (c) =>
          c.status === "CONNECTED" &&
          !c.authorized_scopes?.includes("DEVICE_CREDENTIAL_MANAGEMENT"),
      ) && <p>Square must be reconnected to enable Terminal access.</p>}
      {error && <p role="alert">{error}</p>}
      {!data.configured && (
        <p>
          Sandbox configuration is required before connecting Square. Cash and
          external payments remain available.
        </p>
      )}
      {connection ? (
        <>
          <h3>{connection.display_name}</h3>
          <p>
            {connection.status === "CONNECTED"
              ? "Connected"
              : "Needs Reauthorization"}{" "}
            · {connection.country} · {locations.length} locations found ·{" "}
            {data.mappings.length} mapped
          </p>
          <p>
            Last validated:{" "}
            {connection.last_validated_at
              ? new Date(connection.last_validated_at).toLocaleString()
              : "Not checked"}
          </p>
          <details>
            <summary>Merchant details</summary>
            <p>Square Merchant ID: {connection.merchant_id}</p>
          </details>
          <div className="pos-toolbar">
            <button
              disabled={busy || !data.configured}
              onClick={() =>
                void act({ action: "check", connectionId: connection.id })
              }
            >
              Check Connection
            </button>
            <button
              disabled={busy || !data.configured}
              onClick={() => void act({ action: "connect" })}
            >
              Reconnect Square
            </button>
            <button
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    "Disconnect Square? New Square payments will stop. Historical transactions and Trading Docks receipts remain.",
                  )
                )
                  void act({
                    action: "disconnect",
                    connectionId: connection.id,
                    confirmed: true,
                  });
              }}
            >
              Disconnect Square
            </button>
          </div>
          <h3>Store location mappings</h3>
          {data.sites.map((site) => (
            <label key={site.id} className="pos-form-grid">
              {site.name}
              <select
                aria-label={`Square location for ${site.name}`}
                disabled={busy || connection.status !== "CONNECTED"}
                value={
                  data.mappings.find(
                    (m) =>
                      m.site_id === site.id &&
                      m.connection_id === connection.id,
                  )?.location_id ?? ""
                }
                onChange={(e) =>
                  void act({
                    action: "map",
                    connectionId: connection.id,
                    siteId: site.id,
                    locationId: e.target.value,
                  })
                }
              >
                <option value="">Not configured</option>
                {locations.map((l) => (
                  <option
                    key={l.id}
                    value={l.id}
                    disabled={l.status !== "ACTIVE"}
                  >
                    {l.name}
                    {l.status !== "ACTIVE" ? " (unavailable)" : ""}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </>
      ) : (
        <button
          disabled={busy || !data.configured}
          onClick={() => void act({ action: "connect" })}
        >
          Connect Square Sandbox
        </button>
      )}
      {data.connections
        .filter((c) => c.id !== connection?.id)
        .map((c) => (
          <p key={c.id}>
            {c.display_name} · {c.status} · Square Sandbox
          </p>
        ))}
    </section>
  );
}
