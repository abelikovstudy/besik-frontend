/** Resolve controller-relative image paths against the configured API. */
export function resolveImageUrl(
  imageUrl: string,
  apiBase: string,
  origin: string,
): string | undefined {
  if (!imageUrl.trim()) return undefined;
  try {
    const base = new URL(`${apiBase.replace(/\/$/, "")}/`, origin);
    const path = imageUrl.startsWith("/images/") ? imageUrl.slice(1) : imageUrl;
    const url = new URL(path, base);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
