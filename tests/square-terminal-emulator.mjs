import assert from "node:assert/strict";
/** Network-only deterministic Square simulator. Never part of the runtime bundle. */
export class TerminalEmulator {
  codes = new Map();
  checkouts = new Map();
  payments = new Map();
  refunds = new Map();
  calls = [];
  lose = false;
  offline = false;
  busy = false;
  location = "square-location";
  pair(id) {
    const c = this.codes.get(id);
    c.status = "PAIRED";
    c.device_id = "device-" + id;
    c.paired_at = new Date().toISOString();
    return c;
  }
  set(id, status) {
    const c = this.checkouts.get(id);
    c.status = status;
    if (status === "COMPLETED") {
      const p = {
        id: "payment-" + id,
        status: "COMPLETED",
        reference_id: c.reference_id,
        amount_money: c.amount_money,
        location_id: c.location_id,
        card_details: { card: { card_brand: "VISA", last_4: "1234" } },
      };
      this.payments.set(p.id, p);
      c.payment_ids = [p.id];
    }
    return c;
  }
  fetch = async (url, init) => {
    const path = new URL(String(url)).pathname,
      b = init.body ? JSON.parse(init.body) : {};
    this.calls.push({ path, body: b });
    assert.equal(init.headers["Square-Version"], "2026-09-16");
    if (path === "/v2/devices/codes") {
      assert.equal(b.device_code.product_type, "TERMINAL_API");
      if (!this.codes.has(b.idempotency_key))
        this.codes.set(b.idempotency_key, {
          id: b.idempotency_key,
          code: "EBCARJ",
          name: b.device_code.name,
          product_type: "TERMINAL_API",
          location_id: b.device_code.location_id,
          status: "UNPAIRED",
          pair_by: new Date(Date.now() + 300000).toISOString(),
        });
      return Response.json({ device_code: this.codes.get(b.idempotency_key) });
    }
    if (path.startsWith("/v2/devices/codes/"))
      return Response.json({
        device_code: this.codes.get(path.split("/").at(-1)),
      });
    if (path === "/v2/devices") return Response.json({devices:[...this.codes.values()].filter(c=>c.device_id).map(c=>({id:"device:"+c.id,attributes:{manufacturers_id:c.device_id}}))});
    if (path.startsWith("/v2/devices/"))
      return Response.json({
        device: {
          id: path.split("/").at(-1),
          status: { category: this.offline ? "OFFLINE" : "AVAILABLE" },
        },
      });
    if (path === "/v2/terminals/checkouts") {
      if (this.busy || this.offline)
        return Response.json(
          { errors: [{ code: this.busy ? "DEVICE_BUSY" : "DEVICE_OFFLINE" }] },
          { status: 400 },
        );
      assert.equal(b.checkout.device_options.tip_settings.allow_tipping, false);
      assert.equal(b.checkout.device_options.skip_receipt_screen, true);
      assert.equal(b.checkout.deadline_duration, undefined);
      if (!this.checkouts.has(b.idempotency_key))
        this.checkouts.set(b.idempotency_key, {
          ...b.checkout,
          id: b.idempotency_key,
          status: "PENDING",
          location_id: this.location,
        });
      if (this.lose) {
        this.lose = false;
        throw Error("lost response after acceptance");
      }
      return Response.json({ checkout: this.checkouts.get(b.idempotency_key) });
    }
    if (path.startsWith("/v2/terminals/checkouts/")) {
      const id = path.split("/")[4];
      if (path.endsWith("/cancel")) this.set(id, "CANCELED");
      return Response.json({ checkout: this.checkouts.get(id) });
    }
    if (path.startsWith("/v2/payments/"))
      return Response.json({
        payment: this.payments.get(path.split("/").at(-1)),
      });
    if (path === "/v2/refunds") {
      if (!this.refunds.has(b.idempotency_key))
        this.refunds.set(b.idempotency_key, {
          id: b.idempotency_key,
          payment_id: b.payment_id,
          amount_money: b.amount_money,
          status: "COMPLETED",
        });
      return Response.json({ refund: this.refunds.get(b.idempotency_key) });
    }
    if (path.startsWith("/v2/refunds/"))
      return Response.json({
        refund: this.refunds.get(path.split("/").at(-1)),
      });
    throw Error("Unexpected emulator request: " + path);
  };
}
