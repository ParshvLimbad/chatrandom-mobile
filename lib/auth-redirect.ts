export const AUTH_CALLBACK_PATH = "/auth-callback";
const AUTH_LANDING_PATH = "/auth";
const WRAPPED_URL_PARAM_KEYS = [
  "link",
  "linkingUrl",
  "redirect",
  "redirectTo",
  "redirectUrl",
  "url",
] as const;

function containsAuthPayload(value: string): boolean {
  return (
    value.includes("access_token=") ||
    value.includes("refresh_token=") ||
    value.includes("error_code=") ||
    value.includes("error_description=")
  );
}

function normalizePathname(pathname: string): string {
  if (!pathname) {
    return "/";
  }

  const withLeadingSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return withLeadingSlash.replace(/^\/--(?=\/|$)/, "").replace(/\/{2,}/g, "/");
}

function isAuthRoute(pathname: string): boolean {
  const normalizedPath = normalizePathname(pathname);
  return normalizedPath === "/auth" || normalizedPath === AUTH_CALLBACK_PATH;
}

function getNestedCandidates(rawValue: string): string[] {
  const nestedValues = new Set<string>();

  try {
    const url = new URL(rawValue, "speaky:///");

    for (const key of WRAPPED_URL_PARAM_KEYS) {
      const value = url.searchParams.get(key);
      if (value) {
        nestedValues.add(value);
      }
    }
  } catch {
    // Ignore malformed URLs. We'll fall back to string heuristics below.
  }

  try {
    const decodedValue = decodeURIComponent(rawValue);
    if (decodedValue !== rawValue) {
      nestedValues.add(decodedValue);
    }
  } catch {
    // Ignore invalid percent-encoding.
  }

  return [...nestedValues];
}

function isAuthCallbackCandidate(rawValue: string): boolean {
  if (!rawValue) {
    return false;
  }

  if (containsAuthPayload(rawValue)) {
    return true;
  }

  try {
    const url = new URL(rawValue, "speaky:///");
    const hostname = url.hostname.toLowerCase();
    const normalizedPath = normalizePathname(url.pathname);
    const normalizedLocation = `${normalizedPath}${url.search}${url.hash}`;

    return (
      containsAuthPayload(normalizedLocation) ||
      hostname === "auth" ||
      hostname === "auth-callback" ||
      isAuthRoute(normalizedPath)
    );
  } catch {
    return (
      rawValue.includes("://auth") ||
      rawValue.includes("auth-callback") ||
      rawValue.includes("/--/auth")
    );
  }
}

export function resolveAuthCallbackPath(rawPath: string): string | null {
  if (!rawPath) {
    return null;
  }

  const queue = [rawPath];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentPath = queue.shift();
    if (!currentPath || visited.has(currentPath)) {
      continue;
    }

    visited.add(currentPath);

    if (isAuthCallbackCandidate(currentPath)) {
      return AUTH_LANDING_PATH;
    }

    for (const nestedCandidate of getNestedCandidates(currentPath)) {
      if (!visited.has(nestedCandidate)) {
        queue.push(nestedCandidate);
      }
    }
  }

  return null;
}
