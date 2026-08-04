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
export type CandleRow = {
  date: string;
  close: number;
  high: number;
  low: number;
  volume: number;
};

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

/** Daily candles (close/high/low/volume) for technical & historical analysis. */
export async function fetchCandles(symbol: string, range = "5y"): Promise<CandleRow[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol,
    )}?range=${range}&interval=1d`;
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) return [];
    const json = (await res.json()) as ChartResponse;
    const result = json.chart?.result?.[0];
    if (!result) return [];
    const ts = result.timestamp ?? [];
    const q = (result.indicators?.quote?.[0] ?? {}) as {
      close?: (number | null)[];
      high?: (number | null)[];
      low?: (number | null)[];
      volume?: (number | null)[];
    };
    const rows: CandleRow[] = [];
    ts.forEach((t, i) => {
      const close = q.close?.[i];
      if (typeof close !== "number" || !Number.isFinite(close)) return;
      rows.push({
        date: new Date(t * 1000).toISOString().slice(0, 10),
        close,
        high: typeof q.high?.[i] === "number" ? (q.high[i] as number) : close,
        low: typeof q.low?.[i] === "number" ? (q.low[i] as number) : close,
        volume: typeof q.volume?.[i] === "number" ? (q.volume[i] as number) : 0,
      });
    });
    return rows;
  } catch (error) {
    console.error("[market] candles failed", symbol, error);
    return [];
  }
}

export type Fundamentals = {
  available: boolean;
  sector: string;
  industry: string;
  summary: string;
  marketCap: number | null;
  enterpriseValue: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
  pegRatio: number | null;
  eps: number | null;
  bookValue: number | null;
  priceToBook: number | null;
  roe: number | null;
  roa: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
  dividendYield: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  freeCashflow: number | null;
  operatingCashflow: number | null;
  operatingMargin: number | null;
  profitMargin: number | null;
  ebitdaMargin: number | null;
  totalCash: number | null;
  totalDebt: number | null;
  totalRevenue: number | null;
  ebitda: number | null;
  heldPercentInsiders: number | null;
  heldPercentInstitutions: number | null;
  beta: number | null;
  recommendationKey: string;
  numberOfAnalysts: number | null;
  targetMeanPrice: number | null;
};

const emptyFundamentals: Fundamentals = {
  available: false,
  sector: "",
  industry: "",
  summary: "",
  marketCap: null,
  enterpriseValue: null,
  trailingPE: null,
  forwardPE: null,
  pegRatio: null,
  eps: null,
  bookValue: null,
  priceToBook: null,
  roe: null,
  roa: null,
  debtToEquity: null,
  currentRatio: null,
  quickRatio: null,
  dividendYield: null,
  revenueGrowth: null,
  earningsGrowth: null,
  freeCashflow: null,
  operatingCashflow: null,
  operatingMargin: null,
  profitMargin: null,
  ebitdaMargin: null,
  totalCash: null,
  totalDebt: null,
  totalRevenue: null,
  ebitda: null,
  heldPercentInsiders: null,
  heldPercentInstitutions: null,
  beta: null,
  recommendationKey: "",
  numberOfAnalysts: null,
  targetMeanPrice: null,
};

type RawValue = number | { raw?: number } | undefined | null;

function num(value: RawValue): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object" && typeof value.raw === "number") return value.raw;
  return null;
}

/**
 * Yahoo quoteSummary fundamentals. Yahoo throttles this endpoint aggressively,
 * so callers must handle `available: false` and label figures accordingly.
 */
export async function fetchFundamentals(symbol: string): Promise<Fundamentals> {
  const modules =
    "summaryProfile,summaryDetail,defaultKeyStatistics,financialData,majorHoldersBreakdown";
  for (const host of ["query1", "query2"]) {
    try {
      const res = await fetch(
        `https://${host}.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
          symbol,
        )}?modules=${modules}`,
        { headers: { "User-Agent": UA, Accept: "application/json" } },
      );
      if (!res.ok) continue;
      const json = (await res.json()) as {
        quoteSummary?: { result?: Array<Record<string, Record<string, RawValue | string>>> };
      };
      const r = json.quoteSummary?.result?.[0];
      if (!r) continue;
      const profile = r['summaryProfile'] ?? {};
      const detail = r['summaryDetail'] ?? {};
      const stats = r['defaultKeyStatistics'] ?? {};
      const fin = r['financialData'] ?? {};
      const holders = r['majorHoldersBreakdown'] ?? {};
      const revenue = num(fin['totalRevenue'] as RawValue);
      const ebitda = num(fin['ebitda'] as RawValue);
      return {
        ...emptyFundamentals,
        available: true,
        sector: String(profile['sector'] ?? ""),
        industry: String(profile['industry'] ?? ""),
        summary: String(profile['longBusinessSummary'] ?? ""),
        marketCap: num(detail['marketCap'] as RawValue),
        enterpriseValue: num(stats['enterpriseValue'] as RawValue),
        trailingPE: num(detail['trailingPE'] as RawValue),
        forwardPE: num(detail['forwardPE'] as RawValue),
        pegRatio: num(stats['pegRatio'] as RawValue),
        eps: num(stats['trailingEps'] as RawValue),
        bookValue: num(stats['bookValue'] as RawValue),
        priceToBook: num(stats['priceToBook'] as RawValue),
        roe: num(fin['returnOnEquity'] as RawValue),
        roa: num(fin['returnOnAssets'] as RawValue),
        debtToEquity: num(fin['debtToEquity'] as RawValue),
        currentRatio: num(fin['currentRatio'] as RawValue),
        quickRatio: num(fin['quickRatio'] as RawValue),
        dividendYield: num(detail['dividendYield'] as RawValue),
        revenueGrowth: num(fin['revenueGrowth'] as RawValue),
        earningsGrowth: num(fin['earningsGrowth'] as RawValue),
        freeCashflow: num(fin['freeCashflow'] as RawValue),
        operatingCashflow: num(fin['operatingCashflow'] as RawValue),
        operatingMargin: num(fin['operatingMargins'] as RawValue),
        profitMargin: num(fin['profitMargins'] as RawValue),
        ebitdaMargin: num(fin['ebitdaMargins'] as RawValue) ??
          (revenue && ebitda ? ebitda / revenue : null),
        totalCash: num(fin['totalCash'] as RawValue),
        totalDebt: num(fin['totalDebt'] as RawValue),
        totalRevenue: revenue,
        ebitda,
        heldPercentInsiders: num(holders['insidersPercentHeld'] as RawValue),
        heldPercentInstitutions: num(holders['institutionsPercentHeld'] as RawValue),
        beta: num(detail['beta'] as RawValue),
        recommendationKey: String(fin['recommendationKey'] ?? ""),
        numberOfAnalysts: num(fin['numberOfAnalystOpinions'] as RawValue),
        targetMeanPrice: num(fin['targetMeanPrice'] as RawValue),
      };
    } catch (error) {
      console.error("[market] fundamentals failed", symbol, error);
    }
  }
  return emptyFundamentals;
}