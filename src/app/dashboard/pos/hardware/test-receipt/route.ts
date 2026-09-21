import { requireServerCapability } from "@/lib/platform/server-access";
import { renderReceipt } from "@/lib/pos/receipt";
import { hardwareTestReceipt } from "@/lib/hardware/test-receipt";
export async function GET() {
  await requireServerCapability("pos.sell");
  return new Response(renderReceipt(hardwareTestReceipt()), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'",
    },
  });
}
