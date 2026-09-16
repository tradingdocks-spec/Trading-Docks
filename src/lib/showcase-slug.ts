export const SHOWCASE_RESERVED_SLUGS = new Set(["dashboard", "api", "auth", "login", "signup", "kiosk", "admin", "s", "settings", "account"]);
export const SHOWCASE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function showcaseSlugError(slug: string) {
  if (slug.length < 3 || slug.length > 64 || !SHOWCASE_SLUG_PATTERN.test(slug)) return "Use 3–64 lowercase letters, numbers, and single hyphens.";
  if (SHOWCASE_RESERVED_SLUGS.has(slug)) return "That public slug is reserved. Choose another.";
  return null;
}
