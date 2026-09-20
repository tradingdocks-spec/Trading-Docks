import { paymentRoute } from "@/lib/pos/payments/server";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return paymentRoute(request, "check", (await context.params).id);
}
