import { activeHardware } from "@/lib/hardware/catalog";
import {
  hardwareSource,
  purchaseEvent,
  purchaseLink,
} from "@/lib/hardware/links";
import { affiliateConfig } from "@/lib/hardware/server";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const item = activeHardware().find((item) => item.id === id);
  const link = item && purchaseLink(item, affiliateConfig());
  if (!item || !link)
    return new Response("Hardware purchase link unavailable", { status: 404 });
  console.info(
    "hardware_purchase_click",
    purchaseEvent(
      item,
      link.retailer,
      hardwareSource(new URL(request.url).searchParams.get("source")),
    ),
  );
  return new Response(null, {
    status: 302,
    headers: {
      Location: link.url,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
