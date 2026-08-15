type ResolveRequestOriginInput = {
  forwardedHost?: string | null;
  host?: string | null;
  forwardedProtocol?: string | null;
  fallbackOrigin?: string | null;
};

const LOCAL_HOST_PATTERN = /^(localhost|127\.0\.0\.1)(?::\d+)?$/;

export function resolveRequestOrigin({
  forwardedHost,
  host,
  forwardedProtocol,
  fallbackOrigin,
}: ResolveRequestOriginInput) {
  const headerHost = firstHeaderValue(forwardedHost) ?? firstHeaderValue(host);
  if (headerHost) {
    const parsed = parseOriginLikeValue(headerHost);
    if (parsed) return parsed;

    const cleanHost = stripSlashes(headerHost);
    const protocol = normalizeProtocol(forwardedProtocol, cleanHost);
    return `${protocol}://${cleanHost}`;
  }

  const fallback = parseOriginLikeValue(fallbackOrigin);
  return fallback ?? "http://localhost:3000";
}

function firstHeaderValue(value?: string | null) {
  const first = value?.split(",")[0]?.trim();
  return first || null;
}

function parseOriginLikeValue(value?: string | null) {
  const candidate = firstHeaderValue(value);
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

function normalizeProtocol(forwardedProtocol: string | null | undefined, host: string) {
  const protocol = firstHeaderValue(forwardedProtocol)?.replace(/:$/, "");
  if (protocol === "http" || protocol === "https") return protocol;
  return LOCAL_HOST_PATTERN.test(host) ? "http" : "https";
}

function stripSlashes(value: string) {
  return value.replace(/^\/+/, "").replace(/\/+$/, "");
}
