import { NextRequest, NextResponse } from "next/server";

import {
  isPreviewPlan,
  PLAN_PREVIEW_COOKIE,
} from "@/lib/admin-plan-preview";
import { requireRouteAccess } from "@/lib/platform/server-access";

export async function GET(request: NextRequest) {
  const result = await requireRouteAccess("/dashboard/admin/preview");
  if (!result.access.canAccessCommandCenter) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const plan = request.nextUrl.searchParams.get("plan");
  const destination = request.nextUrl.searchParams.get("next");
  const safeDestination =
    destination?.startsWith("/dashboard") === true && !destination.startsWith("//")
      ? destination
      : "/dashboard";
  const response = NextResponse.redirect(new URL(safeDestination, request.url));

  if (isPreviewPlan(plan)) {
    response.cookies.set(PLAN_PREVIEW_COOKIE, plan, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/dashboard",
      maxAge: 60 * 60 * 4,
    });
  } else {
    response.cookies.delete(PLAN_PREVIEW_COOKIE);
  }

  return response;
}
