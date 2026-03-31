import { resolveAuthCallbackPath } from "@/lib/auth-redirect";

interface RedirectSystemPathInput {
  initial: boolean;
  path: string;
}

export function redirectSystemPath({
  path,
}: RedirectSystemPathInput): string | null {
  try {
    return resolveAuthCallbackPath(path) ?? path;
  } catch {
    return "/auth";
  }
}
