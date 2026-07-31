import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
import {
  CANONICAL_HOST,
  persistentAuthCookieOptions,
  REMEMBER_ME_COOKIE,
} from "@/lib/supabase/auth-cookie-policy";

type PendingCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

const MAX_API_BODY_BYTES = 5 * 1024 * 1024;
const PROTECTED_API_PREFIXES = [
  "/api/csv-converter/",
  "/api/deck-vault/",
  "/api/inventory/",
  "/api/tcgcsv/",
  "/api/tools/",
];

function redirectWithSessionCookies(
  url: URL,
  pendingCookies: PendingCookie[],
) {
  const redirectResponse = NextResponse.redirect(url);

  // Apply the original cookie options directly. Reading cookies back from a
  // response can lose Max-Age/Expires metadata, turning a persistent session
  // back into a browser-session cookie during a redirect.
  pendingCookies.forEach(({ name, value, options }) => {
    redirectResponse.cookies.set(name, value, options);
  });

  return redirectResponse;
}

export async function updateSession(request: NextRequest) {
  const requestHost =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ??
    request.headers.get("host")?.split(":")[0]?.trim();

  // Authentication has one public origin. Normalize the apex domain and
  // Vercel's technical domain before rendering or starting an auth flow so
  // users never create isolated sessions on multiple hosts.
  if (
    process.env.NODE_ENV === "production" &&
    requestHost &&
    requestHost !== CANONICAL_HOST
  ) {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.protocol = "https";
    canonicalUrl.hostname = CANONICAL_HOST;
    canonicalUrl.port = "";
    return NextResponse.redirect(canonicalUrl, 308);
  }

  const rememberMe =
    request.cookies.get(REMEMBER_ME_COOKIE)?.value !== "false";
  let pendingCookies: PendingCookie[] = [];
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: persistentAuthCookieOptions({}, rememberMe),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          pendingCookies = cookiesToSet.map(({ name, value, options }) => ({
            name,
            value,
            options: persistentAuthCookieOptions(options, rememberMe),
          }));

          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          pendingCookies.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isApiRoute = request.nextUrl.pathname.startsWith("/api/");
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (
    isApiRoute &&
    Number.isFinite(contentLength) &&
    contentLength > MAX_API_BODY_BYTES
  ) {
    return NextResponse.json(
      { error: "Request payload is too large." },
      { status: 413 },
    );
  }

  const isProtectedApiRoute = PROTECTED_API_PREFIXES.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix),
  );
  if (!user && isProtectedApiRoute) {
    return NextResponse.json(
      { error: "Sign in is required." },
      { status: 401 },
    );
  }

  const isDashboardRoute = request.nextUrl.pathname.startsWith("/dashboard");
  const isOnboardingRoute = request.nextUrl.pathname.startsWith("/onboarding");
  const isHomePage = request.nextUrl.pathname === "/";
  const isAuthPage =
    request.nextUrl.pathname === "/sign-in" ||
    request.nextUrl.pathname === "/sign-up";

  if (!user && (isDashboardRoute || isOnboardingRoute)) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return redirectWithSessionCookies(url, pendingCookies);
  }

  if (user && (isHomePage || isAuthPage)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return redirectWithSessionCookies(url, pendingCookies);
  }

  return response;
}
