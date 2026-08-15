import assert from "node:assert/strict";
import test from "node:test";

import { resolveRequestOrigin } from "../src/lib/request-origin.ts";

test("request origin uses forwarded host and protocol", () => {
  assert.equal(
    resolveRequestOrigin({
      forwardedHost: "trading-docks-346a.vercel.app",
      forwardedProtocol: "https",
      host: "internal.vercel",
    }),
    "https://trading-docks-346a.vercel.app",
  );
});

test("request origin does not double-prefix scheme-bearing forwarded hosts", () => {
  assert.equal(
    resolveRequestOrigin({
      forwardedHost: "https://trading-docks-346a.vercel.app/",
      forwardedProtocol: "https",
      host: "internal.vercel",
    }),
    "https://trading-docks-346a.vercel.app",
  );
});

test("request origin handles comma-delimited proxy headers", () => {
  assert.equal(
    resolveRequestOrigin({
      forwardedHost: "preview.tradingdocks.com, internal.vercel",
      forwardedProtocol: "https, http",
    }),
    "https://preview.tradingdocks.com",
  );
});

test("request origin keeps local development on http", () => {
  assert.equal(
    resolveRequestOrigin({ host: "localhost:3000" }),
    "http://localhost:3000",
  );
});

test("request origin falls back to a configured site origin", () => {
  assert.equal(
    resolveRequestOrigin({
      fallbackOrigin: "https://www.tradingdocks.com/",
    }),
    "https://www.tradingdocks.com",
  );
});
