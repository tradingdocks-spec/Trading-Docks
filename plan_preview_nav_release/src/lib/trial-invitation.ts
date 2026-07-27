type TrialInvitation = {
  email: string;
  planId: string;
  endsAt: string;
  signupUrl: string;
};

const PLAN_NAMES: Record<string, string> = {
  collector: "Collector",
  seller: "Seller",
  business: "Business",
};

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character]!,
  );
}

export function buildTrialInvitation({
  email,
  planId,
  endsAt,
  signupUrl,
}: TrialInvitation) {
  const planName = PLAN_NAMES[planId] ?? "Premium";
  const expiration = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(endsAt));
  const safeSignupUrl = escapeHtml(signupUrl);
  const safeEmail = escapeHtml(email);
  const subject = `You’re invited: Explore Trading Docks ${planName} free`;
  const text = `Hi there,

Your complimentary Trading Docks ${planName} trial is ready through ${expiration}.

Trading Docks is the command center built for TCG sellers. It replaces scattered spreadsheets and disconnected tools with one organized workspace for inventory, pricing, sales, and daily operations.

KNOW WHAT YOU OWN
Organize singles, sealed products, collections, binders, and decks. Keep inventory locations and product details easy to find.

BUY AND PRICE WITH CONFIDENCE
Compare card and sealed-product prices, watch the market, and identify buying opportunities before they disappear.

RUN THE BUSINESS, NOT MORE SPREADSHEETS
Track sales, marketplace payouts, expenses, tasks, and performance from one central dashboard.

Whether you sell on the side or operate a growing TCG business, Trading Docks helps you save time, protect your margins, and make smarter decisions.

Start your free trial: ${signupUrl}

No payment information is required. Create your account with ${email} and your complimentary access will connect automatically.

Welcome aboard,
Jeremy Robertson
Founder, Trading Docks`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="dark">
    <style>
      @media only screen and (max-width:560px) {
        .td-shell { padding:12px 6px !important; }
        .td-pad { padding-left:22px !important; padding-right:22px !important; }
        .td-title { font-size:28px !important; }
        .td-feature { display:block !important; width:auto !important; padding:0 0 12px !important; }
      }
    </style>
  </head>
  <body style="margin:0;background:#02070b;color:#e2e8f0;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">Your Trading Docks workspace is ready. Explore inventory, market intelligence, seller operations, and more—free through ${expiration}.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="td-shell" style="background:#02070b;padding:28px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:660px;border:1px solid #163242;border-radius:24px;overflow:hidden;background:#07131c">
          <tr><td class="td-pad" style="padding:26px 34px;border-bottom:1px solid #15303e;background:#081b25">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
              <td style="font-size:14px;font-weight:800;letter-spacing:2.4px;color:#67e8f9;text-transform:uppercase">TRADING <span style="color:#f8fafc">DOCKS</span></td>
              <td align="right"><span style="display:inline-block;border:1px solid #285062;border-radius:999px;padding:7px 11px;color:#a5f3fc;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase">${planName} Trial</span></td>
            </tr></table>
          </td></tr>
          <tr><td class="td-pad" style="padding:42px 38px 34px;background:linear-gradient(135deg,#0b2733 0%,#07131c 68%)">
            <div style="font-size:11px;font-weight:800;letter-spacing:2px;color:#fcd34d;text-transform:uppercase">Your invitation is ready</div>
            <h1 class="td-title" style="margin:14px 0 14px;font-size:34px;line-height:1.14;letter-spacing:-.7px;color:#ffffff">Run your TCG business from one powerful workspace.</h1>
            <p style="margin:0;color:#a8bac7;font-size:16px;line-height:1.75">You have complimentary access to Trading Docks through <strong style="color:#f8fafc">${expiration}</strong>. Explore the tools built to help sellers stay organized, move faster, and protect their margins.</p>
            <div style="padding-top:26px">
              <a href="${safeSignupUrl}" style="display:inline-block;border-radius:12px;background:#fcd34d;color:#17200d;text-decoration:none;font-size:15px;font-weight:800;padding:15px 25px;box-shadow:0 8px 24px rgba(252,211,77,.14)">Start My Free Trial&nbsp; →</a>
            </div>
          </td></tr>
          <tr><td class="td-pad" style="padding:34px 38px 10px">
            <p style="margin:0 0 22px;font-size:13px;font-weight:800;letter-spacing:1.5px;color:#67e8f9;text-transform:uppercase">Everything a seller needs to stay ahead</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td valign="top" class="td-feature" style="padding:0 9px 18px 0;width:50%">
                  <div style="min-height:126px;border:1px solid #17303e;border-radius:15px;background:#091923;padding:18px">
                    <div style="font-size:20px">◫</div><h2 style="margin:10px 0 7px;font-size:15px;color:#ffffff">Know what you own</h2>
                    <p style="margin:0;color:#8195a3;font-size:12px;line-height:1.65">Organize singles, sealed products, collections, binders, decks, and inventory locations.</p>
                  </div>
                </td>
                <td valign="top" class="td-feature" style="padding:0 0 18px 9px;width:50%">
                  <div style="min-height:126px;border:1px solid #17303e;border-radius:15px;background:#091923;padding:18px">
                    <div style="font-size:20px">↗</div><h2 style="margin:10px 0 7px;font-size:15px;color:#ffffff">Price with confidence</h2>
                    <p style="margin:0;color:#8195a3;font-size:12px;line-height:1.65">Compare marketplace pricing, monitor trends, and spot promising buying opportunities.</p>
                  </div>
                </td>
              </tr>
              <tr>
                <td valign="top" class="td-feature" style="padding:0 9px 18px 0;width:50%">
                  <div style="min-height:126px;border:1px solid #17303e;border-radius:15px;background:#091923;padding:18px">
                    <div style="font-size:20px">◎</div><h2 style="margin:10px 0 7px;font-size:15px;color:#ffffff">See the whole business</h2>
                    <p style="margin:0;color:#8195a3;font-size:12px;line-height:1.65">Track sales, payouts, expenses, performance, purchasing, and collections in one place.</p>
                  </div>
                </td>
                <td valign="top" class="td-feature" style="padding:0 0 18px 9px;width:50%">
                  <div style="min-height:126px;border:1px solid #17303e;border-radius:15px;background:#091923;padding:18px">
                    <div style="font-size:20px">⚡</div><h2 style="margin:10px 0 7px;font-size:15px;color:#ffffff">Move work forward</h2>
                    <p style="margin:0;color:#8195a3;font-size:12px;line-height:1.65">Manage seller tasks and daily operations without bouncing between disconnected tools.</p>
                  </div>
                </td>
              </tr>
            </table>
          </td></tr>
          <tr><td class="td-pad" style="padding:18px 38px 34px;text-align:center">
            <p style="margin:0 0 18px;color:#cbd5e1;font-size:15px;line-height:1.7"><strong style="color:#ffffff">No credit card. No commitment.</strong><br><span style="color:#718594;font-size:13px">Create your account and start exploring in just a few minutes.</span></p>
            <a href="${safeSignupUrl}" style="display:inline-block;border-radius:12px;background:#fcd34d;color:#17200d;text-decoration:none;font-size:15px;font-weight:800;padding:15px 27px">Explore Trading Docks&nbsp; →</a>
            <p style="margin:17px 0 0;color:#526977;font-size:11px;line-height:1.7">Sign up using <strong style="color:#8da3b0">${safeEmail}</strong><br>so your trial connects automatically.</p>
          </td></tr>
          <tr><td class="td-pad" style="border-top:1px solid #142d3a;padding:24px 38px;background:#061018;color:#607684;font-size:12px;line-height:1.7">
            <strong style="color:#d6e1e7">Welcome aboard.</strong> We’re excited to help you build a smarter, more organized TCG business.<br><br>
            <strong style="color:#cbd5e1">Jeremy Robertson</strong><br>Founder, Trading Docks
          </td></tr>
        </table>
        <p style="margin:18px 0 0;color:#344b58;font-size:10px;line-height:1.6">This invitation was sent to ${safeEmail} because you were selected for complimentary Trading Docks access.</p>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}
