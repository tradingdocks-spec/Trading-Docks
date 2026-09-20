import { squareSettingsRoute } from "@/lib/pos/payments/square/server";
export const runtime="nodejs";
export async function GET(request: Request) { return squareSettingsRoute(request); }
export async function POST(request: Request) { return squareSettingsRoute(request); }
