const worker = {
  async email(message, env) {
    const recipient = String(message.to || "").toLowerCase();
    if (!/^td_[a-f0-9]{18}@inbound\.tradingdocks\.com$/.test(recipient)) {
      message.setReject("Unknown Trading Docks import address");
      return;
    }

    const raw = await new Response(message.raw).arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", raw);
    const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const timestamp = String(Date.now());
    const payload = `${timestamp}.${recipient}.${hex}`;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.TD_WEBHOOK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    const signature = [...new Uint8Array(signed)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const response = await fetch("https://www.tradingdocks.com/api/webhooks/cloudflare-email", {
      method: "POST",
      headers: {
        "content-type": "message/rfc822",
        "x-td-timestamp": timestamp,
        "x-td-recipient": recipient,
        "x-td-envelope-from": String(message.from || "").toLowerCase(),
        "x-td-signature": signature,
      },
      body: raw,
    });
    if (!response.ok) throw new Error(`Trading Docks receiver returned ${response.status}`);
  },
};

export default worker;
