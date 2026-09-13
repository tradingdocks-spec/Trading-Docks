import assert from "node:assert/strict";
import test from "node:test";

import { extractPublicEmails } from "../src/lib/marketing/contact-discovery.ts";
import { assertPublicHttpUrl, validateStoreSearch } from "../src/lib/marketing/store-finder.ts";

test("store finder validates supported ZIP and radius values", () => {
  assert.deepEqual(validateStoreSearch("85001-1234", 25), { postalCode: "85001", radius: 25 });
  assert.throws(() => validateStoreSearch("8500", 25), /valid five-digit/);
  assert.throws(() => validateStoreSearch("85001", 7), /supported search radius/);
});

test("public contact extraction only returns visibly published, normalized addresses", () => {
  const emails = extractPublicEmails(`<script>bad@example.com</script><p>Contact us at INFO@Shop.example.com</p><a href="mailto:sales@shop.example.com">Email</a>`);
  assert.deepEqual(emails.sort(), ["info@shop.example.com", "sales@shop.example.com"]);
});

test("contact discovery URL guard rejects private and credential-bearing targets", async () => {
  await assert.rejects(() => assertPublicHttpUrl("http://127.0.0.1"), /private or internal/);
  await assert.rejects(() => assertPublicHttpUrl("https://user:pass@example.com"), /public HTTP/);
  const url = await assertPublicHttpUrl("https://example.com", async () => ({ address: "93.184.216.34", family: 4 }));
  assert.equal(url.hostname, "example.com");
});
