import type { EvidenceItem, TextAnalysis } from "@/lib/types";
import { getPublicConfig } from "@/lib/config";
import { LOCAL_CORPUS } from "@/lib/pipeline/corpus";
import { clamp, unique } from "@/lib/pipeline/math";
import { overlapScore, tokenize } from "@/lib/pipeline/nlp";
import { applyAssessment } from "@/lib/pipeline/stance";
import { decodeXml, sanitizeUrl, unwrapDuckDuckGo, wikiPageUrl } from "@/lib/pipeline/urls";

export function buildSearchQueries(text: TextAnalysis): string[] {
  const queries: string[] = [];
  queries.push(text.mainClaim.slice(0, 160));
  const loc = text.locations[0];
  const event = text.events[0];
  const who = text.entities.find((e) => e.type === "person")?.text;
  if (who && event) queries.push(`${who} ${event}`);
  if (loc && event) queries.push(`${loc} ${event}`);
  if (who && loc) queries.push(`${who} ${loc}`);
  if (text.organizations[0] && event) queries.push(`${text.organizations[0]} ${event}`);
  return unique(queries.map((q) => q.replace(/\s+/g, " ").trim()).filter(Boolean)).slice(0, 3);
}

function scoreEntry(claim: TextAnalysis, tags: string[], body: string): number {
  const claimTokens = tokenize(claim.normalizedClaim);
  const tagScore = overlapScore(
    [...claim.locations, ...claim.events, ...claim.organizations, ...claimTokens].map((t) =>
      t.toLowerCase(),
    ),
    tags,
  );
  const bodyScore = overlapScore(claimTokens, tokenize(body));
  let bonus = 0;
  const blob = `${tags.join(" ")} ${body}`.toLowerCase();
  for (const loc of claim.locations) {
    if (blob.includes(loc.toLowerCase())) bonus += 0.12;
  }
  for (const ev of claim.events) {
    if (blob.includes(ev.toLowerCase())) bonus += 0.08;
  }
  return clamp(tagScore * 0.7 + bodyScore * 0.5 + bonus, 0, 1);
}

export function retrieveLocalEvidence(claim: TextAnalysis): EvidenceItem[] {
  return LOCAL_CORPUS.map((entry) => {
    const relevance = scoreEntry(claim, entry.tags, `${entry.title} ${entry.passage}`);
    const item: EvidenceItem = {
      id: `local-${entry.id}`,
      title: entry.title,
      publisher: entry.publisher,
      url: null,
      date: entry.date,
      passage: entry.passage,
      stance: "neutral",
      relevance: Math.round(relevance * 100) / 100,
      origin: "local_corpus",
    };
    return applyAssessment(item, claim, `${entry.title}. ${entry.passage}`);
  })
    .filter(
      (e) =>
        (e.evidenceClass === "SUPPORTS" || e.evidenceClass === "CONTRADICTS") &&
        ((e.entityMatch ?? 0) >= 0.28 || (e.claimCoverage ?? 0) >= 0.28),
    )
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 4);
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 4500): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

const UA = "VerifAI/1.0 (educational misinformation research)";

interface WikiHit {
  title: string;
  snippet: string;
  pageid: number;
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function wikipediaExtract(title: string): Promise<{ extract: string; url: string; date: string | null }> {
  const api = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts|info&exintro=1&explaintext=1&inprop=url&redirects=1&format=json&utf8=1&titles=${encodeURIComponent(title)}`;
  const res = await fetchWithTimeout(api, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  }, 4000);
  if (!res.ok) {
    return {
      extract: "",
      url: wikiPageUrl(title),
      date: null,
    };
  }
  const data = (await res.json()) as {
    query?: {
      pages?: Record<
        string,
        { extract?: string; fullurl?: string; touched?: string }
      >;
    };
  };
  const page = Object.values(data.query?.pages ?? {})[0];
  return {
    extract: page?.extract ?? "",
    url: wikiPageUrl(title, page?.fullurl),
    date: page?.touched ? page.touched.slice(0, 10) : null,
  };
}

async function searchWikipedia(query: string): Promise<EvidenceItem[]> {
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    query,
  )}&srlimit=5&format=json&utf8=1`;
  const res = await fetchWithTimeout(searchUrl, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { query?: { search?: WikiHit[] } };
  const hits = (data.query?.search ?? []).filter(
    (hit) => !/\(disambiguation\)/i.test(hit.title) && !/^Entity linking$/i.test(hit.title),
  );
  const selected = hits.slice(0, 4);
  const extracts = await Promise.all(
    selected.map(async (hit) => {
      const snippet = hit.snippet.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      try {
        const full = await wikipediaExtract(hit.title);
        return { hit, snippet, extract: full.extract || snippet, url: full.url, date: full.date };
      } catch {
        return {
          hit,
          snippet,
          extract: snippet,
          url: wikiPageUrl(hit.title),
          date: null as string | null,
        };
      }
    }),
  );
  return extracts.map(({ hit, extract, url, date }) => ({
    id: `wiki-${hit.pageid}`,
    title: hit.title,
    publisher: "Wikipedia",
    url,
    date,
    passage: extract.slice(0, 1800),
    stance: "neutral" as const,
    relevance: 0.5,
    origin: "wikipedia" as const,
  }));
}

async function searchTavily(query: string, apiKey: string): Promise<EvidenceItem[]> {
  const res = await fetchWithTimeout(
    "https://api.tavily.com/search",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "advanced",
        max_results: 6,
        include_answer: false,
        include_raw_content: true,
      }),
    },
    7000,
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    results?: {
      title?: string;
      url?: string;
      content?: string;
      raw_content?: string;
      published_date?: string;
    }[];
  };
  return (data.results ?? []).map((r, idx) => ({
    id: `web-tavily-${idx}-${(r.url || r.title || idx).toString().slice(0, 24)}`,
    title: r.title || "Untitled source",
    publisher: hostname(r.url),
    url: r.url || null,
    date: r.published_date?.slice(0, 10) ?? null,
    passage: (r.raw_content || r.content || "").slice(0, 4000),
    stance: "neutral" as const,
    relevance: 0.55,
    origin: "web_search" as const,
  }));
}

async function searchSerper(query: string, apiKey: string): Promise<EvidenceItem[]> {
  const res = await fetchWithTimeout(
    "https://google.serper.dev/search",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({ q: query, num: 8 }),
    },
    6000,
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    organic?: { title?: string; link?: string; snippet?: string; date?: string }[];
  };
  return (data.organic ?? []).map((r, idx) => ({
    id: `web-serper-${idx}`,
    title: r.title || "Untitled source",
    publisher: hostname(r.link),
    url: r.link || null,
    date: r.date ?? null,
    passage: (r.snippet || "").slice(0, 800),
    stance: "neutral" as const,
    relevance: 0.55,
    origin: "web_search" as const,
  }));
}

function hostname(url?: string | null): string {
  if (!url) return "Web source";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Web source";
  }
}

function rssTag(chunk: string, tag: string): string {
  const match = chunk.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return decodeXml(match?.[1] ?? "");
}

async function searchGoogleNews(query: string): Promise<EvidenceItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const res = await fetchWithTimeout(url, { headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml" } }, 5500);
  if (!res.ok) return [];
  const xml = await res.text();
  const chunks = xml.split(/<item>/i).slice(1, 7);
  return chunks
    .map((chunk, idx) => {
      const title = rssTag(chunk, "title");
      const href = chunk.match(/<link[^>]*href="([^"]+)"/i)?.[1];
      const link =
        sanitizeUrl(decodeXml(href || "")) ||
        sanitizeUrl(rssTag(chunk, "link")) ||
        sanitizeUrl(rssTag(chunk, "guid"));
      const sourceName = rssTag(chunk, "source") || hostname(link);
      const pub = rssTag(chunk, "pubDate");
      const snippet = stripTags(rssTag(chunk, "description"));
      if (!link || !title) return null;
      const date = pub ? new Date(pub) : null;
      const item: EvidenceItem = {
        id: `news-gnews-${idx}`,
        title: title.replace(/\s+-\s+[^-]+$/, ""),
        publisher: sourceName || "Google News",
        url: link,
        date: date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : null,
        passage: snippet.slice(0, 900) || title,
        stance: "neutral",
        relevance: 0.58,
        origin: "web_search",
      };
      return item;
    })
    .filter((item): item is EvidenceItem => Boolean(item));
}

async function searchGdelt(query: string): Promise<EvidenceItem[]> {
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=6&format=json&sort=HybridRel`;
  const res = await fetchWithTimeout(url, { headers: { "User-Agent": UA, Accept: "application/json" } }, 6000);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    articles?: { url?: string; title?: string; seendate?: string; domain?: string; language?: string }[];
  };
  return (data.articles ?? [])
    .map((article, idx) => {
      const link = sanitizeUrl(article.url);
      if (!link || !article.title) return null;
      const seen = article.seendate;
      const date = seen && seen.length >= 8 ? `${seen.slice(0, 4)}-${seen.slice(4, 6)}-${seen.slice(6, 8)}` : null;
      const item: EvidenceItem = {
        id: `news-gdelt-${idx}`,
        title: article.title,
        publisher: article.domain || hostname(link),
        url: link,
        date,
        passage: article.title,
        stance: "neutral",
        relevance: 0.6,
        origin: "web_search",
      };
      return item;
    })
    .filter((item): item is EvidenceItem => Boolean(item));
}

async function searchDuckDuckGo(query: string): Promise<EvidenceItem[]> {
  const instantUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const htmlUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const items: EvidenceItem[] = [];

  try {
    const instant = await fetchWithTimeout(instantUrl, { headers: { "User-Agent": UA, Accept: "application/json" } }, 4000);
    if (instant.ok) {
      const data = (await instant.json()) as {
        AbstractText?: string;
        AbstractURL?: string;
        AbstractSource?: string;
        Heading?: string;
        RelatedTopics?: { Text?: string; FirstURL?: string }[];
      };
      const abstractUrl = sanitizeUrl(data.AbstractURL);
      if (abstractUrl && data.AbstractText) {
        items.push({
          id: "ddg-abstract",
          title: data.Heading || query,
          publisher: data.AbstractSource || hostname(abstractUrl),
          url: abstractUrl,
          date: null,
          passage: data.AbstractText.slice(0, 1200),
          stance: "neutral",
          relevance: 0.62,
          origin: /wikipedia/i.test(abstractUrl) ? "wikipedia" : "web_search",
        });
      }
      for (const [idx, topic] of (data.RelatedTopics ?? []).slice(0, 3).entries()) {
        const link = sanitizeUrl(topic.FirstURL);
        if (!link || !topic.Text) continue;
        items.push({
          id: `ddg-related-${idx}`,
          title: topic.Text.slice(0, 90),
          publisher: hostname(link),
          url: link,
          date: null,
          passage: topic.Text,
          stance: "neutral",
          relevance: 0.48,
          origin: /wikipedia/i.test(link) ? "wikipedia" : "web_search",
        });
      }
    }
  } catch {
    /* continue */
  }

  try {
    const htmlRes = await fetchWithTimeout(htmlUrl, { headers: { "User-Agent": UA, Accept: "text/html" } }, 5000);
    if (htmlRes.ok) {
      const html = await htmlRes.text();
      const linkRe = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      let match: RegExpExecArray | null;
      let idx = 0;
      while ((match = linkRe.exec(html)) && idx < 5) {
        const link = unwrapDuckDuckGo(match[1].replace(/&amp;/g, "&"));
        const title = stripTags(match[2]);
        if (!link || !title) continue;
        items.push({
          id: `ddg-html-${idx}`,
          title,
          publisher: hostname(link),
          url: link,
          date: null,
          passage: title,
          stance: "neutral",
          relevance: 0.55,
          origin: /wikipedia/i.test(link) ? "wikipedia" : "web_search",
        });
        idx += 1;
      }
    }
  } catch {
    /* ignore */
  }

  return items;
}

async function searchOpenAlex(query: string): Promise<EvidenceItem[]> {
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per_page=4&mailto=verifai@example.com`;
  const res = await fetchWithTimeout(url, { headers: { "User-Agent": UA, Accept: "application/json" } }, 5000);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    results?: {
      display_name?: string;
      publication_year?: number;
      doi?: string;
      id?: string;
      primary_location?: { landing_page_url?: string; source?: { display_name?: string } };
      abstract_inverted_index?: Record<string, number[]>;
    }[];
  };
  return (data.results ?? [])
    .map((work, idx) => {
      const link =
        sanitizeUrl(work.primary_location?.landing_page_url) ||
        sanitizeUrl(work.doi ? `https://doi.org/${work.doi.replace(/^https?:\/\/doi.org\//, "")}` : null) ||
        sanitizeUrl(work.id);
      if (!link || !work.display_name) return null;
      const item: EvidenceItem = {
        id: `openalex-${idx}`,
        title: work.display_name,
        publisher: work.primary_location?.source?.display_name || "OpenAlex",
        url: link,
        date: work.publication_year ? `${work.publication_year}-01-01` : null,
        passage: work.display_name,
        stance: "neutral",
        relevance: 0.57,
        origin: "web_search",
      };
      return item;
    })
    .filter((item): item is EvidenceItem => Boolean(item));
}

async function searchWikinews(query: string): Promise<EvidenceItem[]> {
  const searchUrl = `https://en.wikinews.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=4&format=json&utf8=1`;
  const res = await fetchWithTimeout(searchUrl, { headers: { "User-Agent": UA, Accept: "application/json" } }, 4000);
  if (!res.ok) return [];
  const data = (await res.json()) as { query?: { search?: { title: string; snippet: string; pageid: number }[] } };
  return (data.query?.search ?? []).slice(0, 3).map((hit) => ({
    id: `wikinews-${hit.pageid}`,
    title: hit.title,
    publisher: "Wikinews",
    url: `https://en.wikinews.org/wiki/${encodeURI(hit.title.replace(/ /g, "_"))}`,
    date: null,
    passage: stripTags(hit.snippet).slice(0, 500),
    stance: "neutral" as const,
    relevance: 0.5,
    origin: "web_search" as const,
  }));
}

async function fetchPageText(url: string): Promise<string | null> {
  try {
    if (!/^https?:\/\//i.test(url)) return null;
    if (/wikipedia\.org/i.test(url)) return null;
    const res = await fetchWithTimeout(
      url,
      {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9",
        },
      },
      3500,
    );
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "";
    if (!/html|text|xml|json/i.test(type)) return null;
    const html = (await res.text()).slice(0, 180000);
    const text = stripTags(html);
    return text.length > 80 ? text.slice(0, 6000) : null;
  } catch {
    return null;
  }
}

async function enrichWithPageText(items: EvidenceItem[]): Promise<EvidenceItem[]> {
  const targets = items.filter((i) => i.url && (i.passage?.length ?? 0) < 900).slice(0, 5);
  const fetched = await Promise.all(
    targets.map(async (item) => {
      const text = item.url ? await fetchPageText(item.url) : null;
      return { id: item.id, text };
    }),
  );
  const map = new Map(fetched.map((f) => [f.id, f.text]));
  return items.map((item) => {
    const extra = map.get(item.id);
    if (!extra) return item;
    return { ...item, passage: `${item.passage}\n${extra}`.slice(0, 6000) };
  });
}

export interface EvidenceBundle {
  items: EvidenceItem[];
  liveAttempted: boolean;
  liveSucceeded: boolean;
  mode: "live" | "mixed" | "local_fallback";
  queries: string[];
}

export async function retrieveEvidence(claim: TextAnalysis): Promise<EvidenceBundle> {
  const queries = buildSearchQueries(claim);
  const config = getPublicConfig();
  const live: EvidenceItem[] = [];
  let liveAttempted = false;
  let liveSucceeded = false;

  if (config.searchConfigured) {
    liveAttempted = true;
    try {
      const q = queries[0];
      const found =
        config.searchProvider === "serper" && config.serperKey
          ? await searchSerper(q, config.serperKey)
          : config.tavilyKey
            ? await searchTavily(q, config.tavilyKey)
            : config.serperKey
              ? await searchSerper(q, config.serperKey)
              : [];
      live.push(...found);
      if (found.length) liveSucceeded = true;
    } catch {
      liveSucceeded = false;
    }
  }

  liveAttempted = true;
  const q = queries[0];
  const extraTasks: Promise<EvidenceItem[]>[] = [
    searchGoogleNews(q).catch(() => []),
    searchGdelt(q).catch(() => []),
    searchDuckDuckGo(q).catch(() => []),
    searchWikinews(q).catch(() => []),
  ];
  if (claim.isDefinitional) extraTasks.push(searchOpenAlex(q).catch(() => []));

  if (config.wikipediaEnabled) {
    extraTasks.unshift(
      (async () => {
        const wikiSeeds = unique(
          [
            queries[0],
            [...claim.locations].sort((a, b) => b.length - a.length)[0],
            claim.entities.find((e) => e.type === "person")?.text,
          ].filter((s): s is string => Boolean(s)),
        ).slice(0, 2);
        let wiki: EvidenceItem[] = [];
        for (const seed of wikiSeeds) {
          const extra = await searchWikipedia(seed);
          wiki = [...wiki, ...extra];
          if (wiki.length >= 3) break;
        }
        return wiki;
      })().catch(() => []),
    );
  }

  const extraResults = await Promise.all(extraTasks);
  for (const batch of extraResults) {
    if (batch.length) {
      liveSucceeded = true;
      live.push(...batch);
    }
  }

  const enrichedLive = await enrichWithPageText(live);
  const assessedLive = enrichedLive.map((item) => applyAssessment(item, claim, `${item.title}. ${item.passage}`));

  const local = retrieveLocalEvidence(claim);
  const usableLocal = assessedLive.length
    ? local.filter((i) => i.evidenceClass === "SUPPORTS" || i.evidenceClass === "CONTRADICTS")
    : local;

  const merged = [...assessedLive, ...usableLocal]
    .filter((item) => (item.passage || "").trim().length > 0)
    .sort((a, b) => b.relevance - a.relevance);

  const seen = new Set<string>();
  const items: EvidenceItem[] = [];
  for (const item of merged) {
    const key = (item.url || item.title).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ ...item, url: sanitizeUrl(item.url) });
    if (items.length >= 12) break;
  }

  const hasLive = items.some((i) => i.origin !== "local_corpus");
  const hasLocal = items.some((i) => i.origin === "local_corpus");
  const mode: EvidenceBundle["mode"] = hasLive && hasLocal ? "mixed" : hasLive ? "live" : "local_fallback";

  return { items, liveAttempted, liveSucceeded, mode, queries };
}

export function evidenceScores(items: EvidenceItem[]): { support: number; contradict: number } {
  const supportItems = items.filter((i) => i.stance === "support");
  const contradictItems = items.filter((i) => i.stance === "contradict");
  const mass = (list: EvidenceItem[]) => {
    if (!list.length) return 0;
    const avg = list.reduce((s, i) => s + i.relevance * (i.credibility ?? 0.55), 0) / list.length;
    const independent = new Set(list.map((i) => i.publisher.toLowerCase())).size;
    return Math.round(clamp(avg * 70 + Math.min(28, list.length * 7 + independent * 4), 0, 96));
  };
  return { support: mass(supportItems), contradict: mass(contradictItems) };
}
