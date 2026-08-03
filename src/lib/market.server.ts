// Server-only data fetchers: Yahoo Finance chart API (live prices) and
// Google News RSS (financial headlines from named publishers).
import type { NewsItem, Quote } from "./market";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36";

type ChartResponse = {
  chart?: {
    result?: Array<{
      meta?: Record<string, number | string | undefined>;
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: (number | null)[]; volume?: (number | null)[] }> };
    }>;
  };
};

export type History = { date: string; close: number }[];

function pctBetween(from: number | undefined, to: number) {
  if (!from || !Number.isFinite(from) || from === 0) return 0;
  return ((to - from) / from) * 100;
}

export async function fetchQuote(
  symbol: string,
  fallbackName: string,
  range = "6mo",
): Promise<Quote & { history: History }> {
  const empty: Quote & { history: History } = {
    symbol,
    name: fallbackName,
    currency: "INR",
    price: NaN,
    prevClose: NaN,
    changePct: 0,
    weekPct: 0,
    monthPct: 0,
    high52: NaN,
    low52: NaN,
    volume: 0,
    avgVolume: 0,
    spark: [],
    history: [],
  };

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol,
    )}?range=${range}&interval=1d`;
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) return { ...empty, error: `Data unavailable (${res.status})` };
    const json = (await res.json()) as ChartResponse;
    const result = json.chart?.result?.[0];
    if (!result) return { ...empty, error: "No data returned" };

    const meta = result.meta ?? {};
    const timestamps = result.timestamp ?? [];
    const closesRaw = result.indicators?.quote?.[0]?.close ?? [];
    const volumesRaw = result.indicators?.quote?.[0]?.volume ?? [];

    const history: History = [];
    const volumes: number[] = [];
    timestamps.forEach((ts, i) => {
      const close = closesRaw[i];
      if (typeof close === "number" && Number.isFinite(close)) {
        history.push({ date: new Date(ts * 1000).toISOString().slice(0, 10), close });
        const vol = volumesRaw[i];
        volumes.push(typeof vol === "number" ? vol : 0);
      }
    });

    const closes = history.map((h) => h.close);
    const price = Number(meta['regularMarketPrice']) || closes.at(-1) || NaN;
    const prevClose =
      Number(meta['chartPreviousClose']) || closes.at(-2) || price;
    const weekAgo = closes.at(-6) ?? closes[0];
    const monthAgo = closes.at(-22) ?? closes[0];
    const avgVolume =
      volumes.length > 0
        ? volumes.slice(-63).reduce((a, b) => a + b, 0) / Math.min(volumes.length, 63)
        : 0;

    return {
      symbol,
      name: String(meta['shortName'] ?? fallbackName ?? symbol),
      currency: String(meta['currency'] ?? "USD"),
      price,
      prevClose,
      changePct: pctBetween(prevClose, price),
      weekPct: pctBetween(weekAgo, price),
      monthPct: pctBetween(monthAgo, price),
      high52: Number(meta['fiftyTwoWeekHigh']) || Math.max(...closes, 0),
      low52: Number(meta['fiftyTwoWeekLow']) || Math.min(...closes.filter(Boolean), 0),
      volume: Number(meta['regularMarketVolume']) || volumes.at(-1) || 0,
      avgVolume,
      spark: closes.slice(-60),
      history,
    };
  } catch (error) {
    console.error("[market] quote failed", symbol, error);
    return { ...empty, error: "Data unavailable" };
  }
}

export async function fetchQuotes(
  items: { symbol: string; name: string }[],
  range = "6mo",
): Promise<Quote[]> {
  const results = await Promise.all(
    items.map(async (item) => {
      const q = await fetchQuote(item.symbol, item.name, range);
      const { history: _history, ...rest } = q;
      return { ...rest, name: item.name || rest.name };
    }),
  );
  return results;
}

function decodeEntities(input: string) {
  return input
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .trim();
}

function tag(block: string, name: string) {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return match ? decodeEntities(match[1] ?? "") : "";
}

/** Google News RSS aggregates the publishers requested (Moneycontrol, ET, Mint, Reuters…). */
export async function fetchNews(query: string, limit = 24): Promise<NewsItem[]> {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
      query,
    )}&hl=en-IN&gl=IN&ceid=IN:en`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return [];
    const xml = await res.text();
    const blocks = xml.split("<item>").slice(1);
    const items: NewsItem[] = blocks.slice(0, limit).map((block, index) => {
      const rawTitle = tag(block, "title");
      const source = tag(block, "source") || rawTitle.split(" - ").at(-1) || "Google News";
      const title = rawTitle.replace(new RegExp(`\\s-\\s${source}$`), "");
      const pub = tag(block, "pubDate");
      return {
        id: `${index}-${title.slice(0, 40)}`,
        title,
        link: tag(block, "link"),
        source,
        publishedAt: pub ? new Date(pub).toISOString() : new Date().toISOString(),
      };
    });
    return items.filter((i) => i.title);
  } catch (error) {
    console.error("[market] news failed", error);
    return [];
  }
}

export async function searchYahoo(query: string) {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
        query,
      )}&quotesCount=8&newsCount=0`,
      { headers: { "User-Agent": UA, Accept: "application/json" } },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as {
      quotes?: Array<Record<string, string | undefined>>;
    };
    return (json.quotes ?? [])
      .filter((q) => q['symbol'])
      .map((q) => ({
        symbol: String(q['symbol']),
        name: String(q['longname'] ?? q['shortname'] ?? q['symbol']),
        exchange: String(q['exchDisp'] ?? ""),
        type: String(q['quoteType'] ?? ""),
        sector: String(q['sector'] ?? ""),
      }));
  } catch (error) {
    console.error("[market] search failed", error);
    return [];
  }
}