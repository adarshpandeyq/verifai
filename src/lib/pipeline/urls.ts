export function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function wikiPageUrl(title: string, fullurl?: string | null): string {
  const clean = sanitizeUrl(fullurl);
  if (clean) return clean;
  const slug = title.trim().replace(/ /g, "_");
  return `https://en.wikipedia.org/wiki/${encodeURI(slug)}`;
}

export function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

export function unwrapDuckDuckGo(href: string): string | null {
  try {
    const parsed = new URL(href, "https://duckduckgo.com");
    const uddg = parsed.searchParams.get("uddg");
    if (uddg) return sanitizeUrl(decodeURIComponent(uddg));
    return sanitizeUrl(parsed.toString());
  } catch {
    return sanitizeUrl(href);
  }
}
