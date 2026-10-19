// Return only to catalog/product pages on the same origin, never back to auth.
export function safeReturnTo(
  value: string | null,
  origin = window.location.origin,
): string {
  try {
    const url = new URL(value || "/", origin);
    if (
      url.origin === origin &&
      (url.pathname === "/" || /^\/products\/[^/]+\/[0-9]+$/.test(url.pathname))
    )
      return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    // A malformed return address falls back to the catalog.
  }
  return "/";
}

export function authPageUrl(
  checkout = false,
  href = window.location.href,
): string {
  const returnTo = new URL(href);
  if (checkout) returnTo.searchParams.set("cart", "1");
  const params = new URLSearchParams({
    returnTo: safeReturnTo(
      `${returnTo.pathname}${returnTo.search}${returnTo.hash}`,
      returnTo.origin,
    ),
  });
  const language = returnTo.searchParams.get("lang");
  if (language === "en" || language === "ka") params.set("lang", language);
  return `/auth?${params}`;
}
