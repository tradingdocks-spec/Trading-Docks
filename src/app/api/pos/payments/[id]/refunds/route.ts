import { paymentRoute } from "@/lib/pos/payments/server";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return paymentRoute(request, "refund", (await context.params).id);
}
