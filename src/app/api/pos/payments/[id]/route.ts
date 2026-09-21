import { paymentRoute } from "@/lib/pos/payments/server";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return paymentRoute(request, "get", (await context.params).id);
}
