import { PaymentOrchestrator } from "../src/lib/pos/payments/orchestrator.ts";
export async function paymentHttp(
  req,
  res,
  url,
  client,
  workspace,
  { loseResponse = false } = {},
) {
  if (!url.pathname.startsWith("/api/pos/payments")) return false;
  const store = async (action, body, refund = false) =>
    (
      await client.query(
        "select public." +
          (refund ? "pos_payment_refund_command" : "pos_payment_command") +
          "($1,$2,$3) result",
        [workspace, action, body],
      )
    ).rows[0].result;
  const service = new PaymentOrchestrator(store, "test");
  let body = {};
  if (req.method === "POST") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    body = JSON.parse(raw);
  }
  const parts = url.pathname
    .replace("/api/pos/payments", "")
    .split("/")
    .filter(Boolean);
  let result;
  if (parts[0] === "capabilities") result = await store("capabilities", {});
  else if (parts[0] === "refunds") result = await service.checkRefund(parts[1]);
  else if (parts[1] === "check") result = await service.check(parts[0]);
  else if (parts[1] === "cancel") result = await service.cancel(parts[0]);
  else if (parts[1] === "refunds")
    result = await service.refund({ ...body, paymentId: parts[0] });
  else if (parts.length) result = await store("get", { id: parts[0] });
  else if (req.method === "POST") result = await service.begin(body);
  else result = await store("list", Object.fromEntries(url.searchParams));
  res.setHeader("Content-Type", "application/json");
  if (loseResponse && req.method === "POST") {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: "Response lost; verify payment." }));
  } else res.end(JSON.stringify(result));
  return true;
}
