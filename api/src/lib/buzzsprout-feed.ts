import RssParser from "rss-parser";
import type { Item } from "rss-parser";

export type BuzzsproutHomeEpisode = {
  id: number;
  title: string;
  description: string;
  buzzsproutUrl: string;
  publishedAt: string;
  duration: string | null;
};

const parser = new RssParser({
  timeout: 15000,
  headers: {
    Accept: "application/rss+xml, application/xml, text/xml, */*",
    "User-Agent": "JamuhuriSite/1.0 (podcast feed reader)",
  },
});

const DEFAULT_RSS = "https://rss.buzzsprout.com/1999543.rss";
const DEFAULT_SITE_BASE = "https://marketcolourpodcast.buzzsprout.com";

function formatDuration(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\d+$/.test(trimmed)) {
    const sec = parseInt(trimmed, 10);
    if (!Number.isFinite(sec) || sec < 0) return null;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
  return trimmed;
}

function guidToEpisodeId(guid: string | undefined): number {
  if (!guid) return 0;
  const m = String(guid).match(/(\d{5,})/);
  return m ? parseInt(m[1], 10) : 0;
}

/** Build public episode URL on the podcast's Buzzsprout site (custom domain). */
function episodeUrlFromEnclosure(
  enclosureUrl: string | undefined,
  siteBase: string,
): string {
  const base = siteBase.replace(/\/$/, "");
  if (!enclosureUrl) return base;
  const m = enclosureUrl.match(/\/episodes\/(\d+)-(.+?)\.mp3$/i);
  if (m) return `${base}/${m[1]}-${m[2]}`;
  return base;
}

function pickDescription(item: Item): string {
  const extended = item as Item & {
    "content:encodedSnippet"?: string;
    itunes?: { summary?: string };
  };
  const text =
    item.contentSnippet ??
    extended["content:encodedSnippet"] ??
    extended.itunes?.summary ??
    "";
  const stripped = text.replace(/<[^>]+>/g, " ");
  return stripped.replace(/\s+/g, " ").trim().slice(0, 2000);
}

export async function fetchBuzzsproutLatestEpisodes(
  limit: number,
): Promise<BuzzsproutHomeEpisode[]> {
  const feedUrl = process.env.BUZZSPROUT_RSS_URL?.trim() || DEFAULT_RSS;
  const siteBase = process.env.BUZZSPROUT_SITE_BASE?.trim() || DEFAULT_SITE_BASE;

  const feed = await parser.parseURL(feedUrl);
  const items = feed.items ?? [];

  return items.slice(0, limit).map((item, index) => {
    const enc = item.enclosure?.url;
    const buzzsproutUrl = episodeUrlFromEnclosure(enc, siteBase);
    const pub =
      item.isoDate ??
      (item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString());
    const durationRaw = (item as { itunes?: { duration?: string } }).itunes?.duration;
    const id = guidToEpisodeId(item.guid != null ? String(item.guid) : undefined) || -(index + 1);

    return {
      id,
      title: item.title?.trim() || "Episode",
      description: pickDescription(item),
      buzzsproutUrl,
      publishedAt: pub,
      duration: formatDuration(durationRaw),
    };
  });
}
