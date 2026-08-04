import { createServerFn } from "@tanstack/react-start";
import { MARKET_GROUPS, STOCK_UNIVERSE, OVERVIEW_SYMBOLS } from "./market";
import {
  fetchCandles,
  fetchFundamentals,
  fetchNews,
  fetchQuote,
  fetchQuotes,
  searchYahoo,
} from "./market.server";

export const getMarketOverview = createServerFn({ method: "GET" }).handler(async () => {
  const quotes = await fetchQuotes(OVERVIEW_SYMBOLS);
  return {
    fetchedAt: new Date().toISOString(),
    groups: MARKET_GROUPS.map((group) => ({
      key: group.key,
      label: group.label,
      quotes: group.items
        .map((item) => quotes.find((q) => q.symbol === item.symbol))
        .filter((q): q is NonNullable<typeof q> => Boolean(q)),
    })),
  };
});

export const getStockBoard = createServerFn({ method: "GET" }).handler(async () => {
  const quotes = await fetchQuotes(STOCK_UNIVERSE);
  return { fetchedAt: new Date().toISOString(), quotes };
});

export const getSymbolDetail = createServerFn({ method: "POST" })
  .inputValidator((input: { symbol: string; name?: string }) => ({
    symbol: String(input.symbol).slice(0, 24),
    name: input.name ? String(input.name).slice(0, 120) : "",
  }))
  .handler(async ({ data }) => {
    const quote = await fetchQuote(data.symbol, data.name || data.symbol, "1y");
    return { fetchedAt: new Date().toISOString(), quote };
  });

export const getQuotesFor = createServerFn({ method: "POST" })
  .inputValidator((input: { symbols: { symbol: string; name: string }[] }) => ({
    symbols: (input.symbols ?? []).slice(0, 40).map((s) => ({
      symbol: String(s.symbol).slice(0, 24),
      name: String(s.name ?? "").slice(0, 120),
    })),
  }))
  .handler(async ({ data }) => {
    if (data.symbols.length === 0) return { quotes: [] };
    return { quotes: await fetchQuotes(data.symbols) };
  });

export const searchSymbols = createServerFn({ method: "POST" })
  .inputValidator((input: { query: string }) => ({ query: String(input.query).slice(0, 60) }))
  .handler(async ({ data }) => {
    if (data.query.trim().length < 2) return { results: [] };
    return { results: await searchYahoo(data.query.trim()) };
  });

export const getFinancialNews = createServerFn({ method: "POST" })
  .inputValidator((input: { topic?: string }) => ({
    topic: String(input?.topic ?? "").slice(0, 80),
  }))
  .handler(async ({ data }) => {
    const base =
      'when:2d (site:moneycontrol.com OR site:economictimes.indiatimes.com OR site:livemint.com OR site:reuters.com OR site:bloomberg.com OR site:cnbc.com OR site:finance.yahoo.com OR site:marketwatch.com)';
    const query = data.topic ? `${data.topic} ${base}` : `stock market OR economy ${base}`;
    const items = await fetchNews(query, 30);
    return { fetchedAt: new Date().toISOString(), items };
  });

/** Full research dossier: 5y candles + fundamentals + recent company news. */
export const getStockDossier = createServerFn({ method: "POST" })
  .inputValidator((input: { symbol: string; name?: string }) => ({
    symbol: String(input.symbol).slice(0, 24),
    name: String(input.name ?? "").slice(0, 120),
  }))
  .handler(async ({ data }) => {
    const [quote, candles, fundamentals, news] = await Promise.all([
      fetchQuote(data.symbol, data.name || data.symbol, "1y"),
      fetchCandles(data.symbol, "5y"),
      fetchFundamentals(data.symbol),
      fetchNews(`${data.name || data.symbol} stock when:14d`, 8),
    ]);
    const { history: _history, ...rest } = quote;
    return { fetchedAt: new Date().toISOString(), quote: rest, candles, fundamentals, news };
  });

export const getCandlesFor = createServerFn({ method: "POST" })
  .inputValidator((input: { symbol: string; range?: string }) => ({
    symbol: String(input.symbol).slice(0, 24),
    range: String(input.range ?? "2y").slice(0, 6),
  }))
  .handler(async ({ data }) => ({ candles: await fetchCandles(data.symbol, data.range) }));