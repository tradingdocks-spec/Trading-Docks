import { paymentRoute } from "@/lib/pos/payments/server";
export async function GET(request: Request) {
  return paymentRoute(request, "capabilities");
}
