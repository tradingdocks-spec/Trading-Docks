import { paymentRoute } from "@/lib/pos/payments/server";
export async function POST(request: Request) {
  return paymentRoute(request, "create");
}
export async function GET(request: Request) {
  return paymentRoute(request, "list");
}
