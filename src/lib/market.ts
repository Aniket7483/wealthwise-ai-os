// Shared, client-safe market metadata + scoring helpers.

export type Quote = {
  symbol: string;
  name: string;
  currency: string;
  price: number;
  prevClose: number;
  changePct: number;
  weekPct: number;
  monthPct: number;
  high52: number;
  low52: number;
  volume: number;
  avgVolume: number;
  spark: number[];
  error?: string;
};

export type MarketGroup = {
  key: string;
  label: string;
  items: { symbol: string; name: string }[];
};

export const MARKET_GROUPS: MarketGroup[] = [
  {
    key: "india",
    label: "Indian indices",
    items: [
      { symbol: "^NSEI", name: "NIFTY 50" },
      { symbol: "^NSEBANK", name: "BANK NIFTY" },
      { symbol: "^BSESN", name: "SENSEX" },
    ],
  },
  {
    key: "global",
    label: "Global indices",
    items: [
      { symbol: "^IXIC", name: "NASDAQ" },
      { symbol: "^GSPC", name: "S&P 500" },
      { symbol: "^DJI", name: "Dow Jones" },
      { symbol: "^FTSE", name: "FTSE 100" },
      { symbol: "^N225", name: "Nikkei 225" },
      { symbol: "^HSI", name: "Hang Seng" },
    ],
  },
  {
    key: "commodities",
    label: "Commodities",
    items: [
      { symbol: "GC=F", name: "Gold" },
      { symbol: "SI=F", name: "Silver" },
      { symbol: "CL=F", name: "Crude Oil (WTI)" },
      { symbol: "NG=F", name: "Natural Gas" },
    ],
  },
  {
    key: "fx-crypto",
    label: "Currency & crypto",
    items: [
      { symbol: "INR=X", name: "USD / INR" },
      { symbol: "BTC-USD", name: "Bitcoin" },
      { symbol: "ETH-USD", name: "Ethereum" },
    ],
  },
];

export const OVERVIEW_SYMBOLS = MARKET_GROUPS.flatMap((g) => g.items);

export const SECTORS = [
  "IT",
  "Banking",
  "Auto",
  "Pharma",
  "Energy",
  "Infrastructure",
  "Defence",
  "FMCG",
  "Real Estate",
  "Metals",
  "Chemicals",
] as const;

export type Sector = (typeof SECTORS)[number];

export type UniverseStock = { symbol: string; name: string; sector: Sector };

/** Liquid NSE large/mid caps used across discovery, scanner and sector views. */
export const STOCK_UNIVERSE: UniverseStock[] = [
  { symbol: "TCS.NS", name: "Tata Consultancy Services", sector: "IT" },
  { symbol: "INFY.NS", name: "Infosys", sector: "IT" },
  { symbol: "WIPRO.NS", name: "Wipro", sector: "IT" },
  { symbol: "HCLTECH.NS", name: "HCL Technologies", sector: "IT" },
  { symbol: "TECHM.NS", name: "Tech Mahindra", sector: "IT" },
  { symbol: "HDFCBANK.NS", name: "HDFC Bank", sector: "Banking" },
  { symbol: "ICICIBANK.NS", name: "ICICI Bank", sector: "Banking" },
  { symbol: "SBIN.NS", name: "State Bank of India", sector: "Banking" },
  { symbol: "AXISBANK.NS", name: "Axis Bank", sector: "Banking" },
  { symbol: "KOTAKBANK.NS", name: "Kotak Mahindra Bank", sector: "Banking" },
  { symbol: "MARUTI.NS", name: "Maruti Suzuki", sector: "Auto" },
  { symbol: "TATAMOTORS.NS", name: "Tata Motors", sector: "Auto" },
  { symbol: "M&M.NS", name: "Mahindra & Mahindra", sector: "Auto" },
  { symbol: "BAJAJ-AUTO.NS", name: "Bajaj Auto", sector: "Auto" },
  { symbol: "EICHERMOT.NS", name: "Eicher Motors", sector: "Auto" },
  { symbol: "SUNPHARMA.NS", name: "Sun Pharmaceutical", sector: "Pharma" },
  { symbol: "CIPLA.NS", name: "Cipla", sector: "Pharma" },
  { symbol: "DRREDDY.NS", name: "Dr. Reddy's Labs", sector: "Pharma" },
  { symbol: "DIVISLAB.NS", name: "Divi's Laboratories", sector: "Pharma" },
  { symbol: "RELIANCE.NS", name: "Reliance Industries", sector: "Energy" },
  { symbol: "ONGC.NS", name: "ONGC", sector: "Energy" },
  { symbol: "NTPC.NS", name: "NTPC", sector: "Energy" },
  { symbol: "POWERGRID.NS", name: "Power Grid Corp", sector: "Energy" },
  { symbol: "LT.NS", name: "Larsen & Toubro", sector: "Infrastructure" },
  { symbol: "ADANIPORTS.NS", name: "Adani Ports & SEZ", sector: "Infrastructure" },
  { symbol: "GRASIM.NS", name: "Grasim Industries", sector: "Infrastructure" },
  { symbol: "ULTRACEMCO.NS", name: "UltraTech Cement", sector: "Infrastructure" },
  { symbol: "HAL.NS", name: "Hindustan Aeronautics", sector: "Defence" },
  { symbol: "BEL.NS", name: "Bharat Electronics", sector: "Defence" },
  { symbol: "BDL.NS", name: "Bharat Dynamics", sector: "Defence" },
  { symbol: "HINDUNILVR.NS", name: "Hindustan Unilever", sector: "FMCG" },
  { symbol: "ITC.NS", name: "ITC", sector: "FMCG" },
  { symbol: "NESTLEIND.NS", name: "Nestlé India", sector: "FMCG" },
  { symbol: "BRITANNIA.NS", name: "Britannia Industries", sector: "FMCG" },
  { symbol: "DLF.NS", name: "DLF", sector: "Real Estate" },
  { symbol: "GODREJPROP.NS", name: "Godrej Properties", sector: "Real Estate" },
  { symbol: "OBEROIRLTY.NS", name: "Oberoi Realty", sector: "Real Estate" },
  { symbol: "TATASTEEL.NS", name: "Tata Steel", sector: "Metals" },
  { symbol: "JSWSTEEL.NS", name: "JSW Steel", sector: "Metals" },
  { symbol: "HINDALCO.NS", name: "Hindalco Industries", sector: "Metals" },
  { symbol: "VEDL.NS", name: "Vedanta", sector: "Metals" },
  { symbol: "PIDILITIND.NS", name: "Pidilite Industries", sector: "Chemicals" },
  { symbol: "SRF.NS", name: "SRF", sector: "Chemicals" },
  { symbol: "UPL.NS", name: "UPL", sector: "Chemicals" },
  { symbol: "DEEPAKNTR.NS", name: "Deepak Nitrite", sector: "Chemicals" },
];

export const NEWS_SOURCES = [
  "Moneycontrol",
  "The Economic Times",
  "Mint",
  "Reuters",
  "Bloomberg",
  "CNBC",
  "Yahoo Finance",
  "MarketWatch",
] as const;

export type NewsItem = {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: string;
};

export type NewsInsight = {
  id: string;
  summary: string;
  category: string;
  companies: string[];
  sectors: string[];
  sentiment: "positive" | "negative" | "neutral";
  importance: number;
};

export type ScoredStock = UniverseStock &
  Quote & {
    momentum: number;
    risk: number;
    growth: number;
    value: number;
    opportunity: number;
    trend: "Uptrend" | "Sideways" | "Downtrend";
    fromHigh: number;
    fromLow: number;
    volumeRatio: number;
    reasons: string[];
  };

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function stdDev(values: number[]) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Deterministic, explainable scoring built only from live price/volume data.
 * Not investment advice and never a profit guarantee.
 */
export function scoreStock(stock: UniverseStock, quote: Quote): ScoredStock {
  const range = Math.max(quote.high52 - quote.low52, 0.0001);
  const fromHigh = ((quote.price - quote.high52) / quote.high52) * 100;
  const fromLow = ((quote.price - quote.low52) / Math.max(quote.low52, 0.0001)) * 100;
  const positionInRange = clamp(((quote.price - quote.low52) / range) * 100);

  const returns: number[] = [];
  for (let i = 1; i < quote.spark.length; i++) {
    const prev = quote.spark[i - 1]!;
    if (prev > 0) returns.push(((quote.spark[i]! - prev) / prev) * 100);
  }
  const volatility = stdDev(returns);

  const momentum = clamp(50 + quote.monthPct * 1.6 + quote.weekPct * 1.2 + quote.changePct * 0.8);
  const risk = clamp(volatility * 22 + Math.max(0, -quote.monthPct) * 1.2);
  const growth = clamp(50 + quote.monthPct * 2 + (positionInRange - 50) * 0.4);
  const value = clamp(100 - positionInRange * 0.8 - Math.max(0, quote.monthPct) * 1.2);
  const volumeRatio = quote.avgVolume > 0 ? quote.volume / quote.avgVolume : 1;

  const opportunity = Math.round(
    clamp(momentum * 0.35 + growth * 0.25 + value * 0.2 + (100 - risk) * 0.2),
  );

  const trend: ScoredStock["trend"] =
    quote.monthPct > 3 ? "Uptrend" : quote.monthPct < -3 ? "Downtrend" : "Sideways";

  const reasons = [
    `Momentum ${Math.round(momentum)}/100 — 1M ${quote.monthPct.toFixed(1)}%, 1W ${quote.weekPct.toFixed(1)}%, today ${quote.changePct.toFixed(1)}%.`,
    `Growth ${Math.round(growth)}/100 — trading at ${Math.round(positionInRange)}% of its 52-week range.`,
    `Valuation proxy ${Math.round(value)}/100 — ${fromHigh.toFixed(1)}% from the 52-week high.`,
    `Risk ${Math.round(risk)}/100 — daily volatility ${volatility.toFixed(2)}% over the last quarter.`,
    `Liquidity — today's volume is ${volumeRatio.toFixed(2)}x the 3-month average.`,
  ];

  return {
    ...stock,
    ...quote,
    momentum: Math.round(momentum),
    risk: Math.round(risk),
    growth: Math.round(growth),
    value: Math.round(value),
    opportunity,
    trend,
    fromHigh,
    fromLow,
    volumeRatio,
    reasons,
  };
}

export function toneFor(change: number) {
  if (change > 0.05) return "text-emerald-600 dark:text-emerald-400";
  if (change < -0.05) return "text-rose-600 dark:text-rose-400";
  return "text-muted-foreground";
}

export function formatPct(value: number) {
  if (!Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatPrice(value: number, currency: string) {
  if (!Number.isFinite(value)) return "—";
  const locale = currency === "INR" ? "en-IN" : "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: value > 1000 ? 0 : 2,
    }).format(value);
  } catch {
    return value.toLocaleString(locale);
  }
}

export function formatVolume(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1e7) return `${(value / 1e7).toFixed(2)} Cr`;
  if (value >= 1e5) return `${(value / 1e5).toFixed(2)} L`;
  return value.toLocaleString("en-IN");
}
