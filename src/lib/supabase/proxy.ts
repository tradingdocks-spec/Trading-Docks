import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
import { scannerBridgeOwnerAccess } from "@/lib/chaos-sort/scanner-bridge-access";
import { privateScannerAcceptance, privateAcceptanceRequestAllowed } from "@/lib/chaos-sort/private-acceptance";
import { contentSecurityPolicy } from "@/lib/content-security-policy";
import {
  persistentAuthCookieOptions,
  REMEMBER_ME_COOKIE,
} from "@/lib/supabase/auth-cookie-policy";
import {
  canonicalizeTradingDocksUrl,
  shouldRedirectToCanonicalHost,
} from "@/lib/supabase/canonical-host";
import {
  apiRequiresAuthentication,
  hasSupabasePublicConfig,
  routeNeedsSessionLookup,
} from "@/lib/supabase/proxy-routing";

type PendingCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

const MAX_API_BODY_BYTES = 5 * 1024 * 1024;

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
  const acceptance = privateScannerAcceptance();
  if (acceptance && !privateAcceptanceRequestAllowed(request.nextUrl.pathname, request.method)) {
    return NextResponse.json({ error: "Private scanner acceptance: this mutation is disabled." }, { status: 403 });
  }
  const requestHost =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ??
    request.headers.get("host")?.split(":")[0]?.trim();

  // Authentication has one public origin. Normalize the apex domain and
  // Vercel's technical domain before rendering or starting an auth flow so
  // users never create isolated sessions on multiple hosts.
  if (shouldRedirectToCanonicalHost(requestHost ?? null)) {
    const canonicalUrl = canonicalizeTradingDocksUrl(request.nextUrl);
    return NextResponse.redirect(canonicalUrl, 308);
  }

  const rememberMe =
    request.cookies.get(REMEMBER_ME_COOKIE)?.value !== "false";
  let pendingCookies: PendingCookie[] = [];
  let response = NextResponse.next({
    request,
  });

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

  const isProtectedApiRoute = apiRequiresAuthentication(
    request.nextUrl.pathname,
  );
  const isDashboardRoute = request.nextUrl.pathname.startsWith("/dashboard");
  const isOnboardingRoute = request.nextUrl.pathname.startsWith("/onboarding");
  const isHomePage = request.nextUrl.pathname === "/";
  const isAuthPage =
    request.nextUrl.pathname === "/sign-in" ||
    request.nextUrl.pathname === "/sign-up";

  if (!acceptance && !routeNeedsSessionLookup(request.nextUrl.pathname)) {
    if (request.nextUrl.pathname.startsWith("/share/")) {
      response.headers.set("Cache-Control", "private, no-store, max-age=0");
      response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
      response.headers.set("Referrer-Policy", "no-referrer");
    }

    if (isApiRoute) {
      response.headers.set("Cache-Control", "no-store");
    }

    return response;
  }

  if (!hasSupabasePublicConfig()) {
    if (isProtectedApiRoute) {
      return NextResponse.json(
        { error: "Authentication is not configured for this deployment." },
        { status: 503 },
      );
    }

    if (isDashboardRoute || isOnboardingRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/sign-in";
      url.searchParams.set(
        "next",
        `${request.nextUrl.pathname}${request.nextUrl.search}`,
      );
      return redirectWithSessionCookies(url, pendingCookies);
    }

    return response;
  }

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

  if (acceptance && user && !(await scannerBridgeOwnerAccess(supabase, user))) {
    return NextResponse.json({ error: "Private owner acceptance only." }, { status: 403 });
  }
  if (acceptance && !user && isApiRoute) {
    return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  }

  if (!user && isProtectedApiRoute) {
    return NextResponse.json(
      { error: "Sign in is required." },
      { status: 401 },
    );
  }

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

  if (request.nextUrl.pathname.startsWith("/share/")) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.headers.set("Referrer-Policy", "no-referrer");
  }

  if (isApiRoute) {
    response.headers.set("Cache-Control", "no-store");
  }

  if (isDashboardRoute) {
    // Scope localhost transport to the same server-verified owner as the UI.
    // Include dashboard entry documents so client navigation to Chaos Sort works.
    const bridgeAllowed = await scannerBridgeOwnerAccess(supabase, user);
    response.headers.set("Content-Security-Policy", contentSecurityPolicy(bridgeAllowed));
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Vary", "Cookie");
  }

  return response;
}
