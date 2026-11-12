export const DEFAULT_REDIRECT = "/dashboard";

/**
 * Only allow same-origin relative paths so a crafted ?redirect= cannot send
 * the user to another site after sign-in. "//host" and "/\host" are rejected
 * because browsers treat both as protocol-relative URLs.
 */
export function getSafeRedirect(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return DEFAULT_REDIRECT;
  }

  return value;
}
