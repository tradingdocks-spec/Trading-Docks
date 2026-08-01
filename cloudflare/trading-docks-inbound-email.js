export default {
  async email(message, env) {
    const recipient = message.to.toLowerCase();
    if (!/^td_[a-f0-9]{18,64}@inbound\.tradingdocks\.com$/.test(recipient)) {
      message.setReject("Unknown Trading Docks import address");
      return;
    }

    const raw = await new Response(message.raw).arrayBuffer();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(env.TD_WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const prefix = new TextEncoder().encode(`${timestamp}.`);
    const signed = new Uint8Array(prefix.length + raw.byteLength);
    signed.set(prefix, 0);
    signed.set(new Uint8Array(raw), prefix.length);
    const signature = await crypto.subtle.sign("HMAC", key, signed);
    const hex = [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

    const response = await fetch("https://www.tradingdocks.com/api/webhooks/cloudflare-email", {
      method: "POST",
      headers: {
        "content-type": "message/rfc822",
        "x-td-timestamp": timestamp,
        "x-td-signature": hex,
        "x-td-recipient": recipient,
        "x-td-sender": message.from,
      },
      body: raw,
    });
    if (!response.ok) throw new Error(`Trading Docks receiver returned ${response.status}`);
  },
};
