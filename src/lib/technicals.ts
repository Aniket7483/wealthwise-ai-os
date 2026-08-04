// Client-safe technical + statistical analytics computed from daily candles.

export type Candle = {
  date: string;
  close: number;
  high: number;
  low: number;
  volume: number;
};

function sma(values: number[], period: number) {
  if (values.length < period) return NaN;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function emaSeries(values: number[], period: number) {
  if (values.length === 0) return [] as number[];
  const k = 2 / (period + 1);
  const out: number[] = [values[0]!];
  for (let i = 1; i < values.length; i++) out.push(values[i]! * k + out[i - 1]! * (1 - k));
  return out;
}

function ema(values: number[], period: number) {
  const series = emaSeries(values, period);
  return series.at(-1) ?? NaN;
}

function stdDev(values: number[]) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1));
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

export function dailyReturns(closes: number[]) {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1]!;
    if (prev > 0) out.push((closes[i]! - prev) / prev);
  }
  return out;
}

export function rsi(closes: number[], period = 14) {
  if (closes.length <= period) return NaN;
  let gain = 0;
  let loss = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i]! - closes[i - 1]!;
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  if (loss === 0) return 100;
  const rs = gain / loss;
  return 100 - 100 / (1 + rs);
}

export function macd(closes: number[]) {
  const fast = emaSeries(closes, 12);
  const slow = emaSeries(closes, 26);
  const line = closes.map((_, i) => (fast[i] ?? 0) - (slow[i] ?? 0));
  const signalSeries = emaSeries(line, 9);
  const value = line.at(-1) ?? 0;
  const signal = signalSeries.at(-1) ?? 0;
  return { macd: value, signal, histogram: value - signal };
}

export function atr(candles: Candle[], period = 14) {
  if (candles.length < period + 1) return NaN;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]!;
    const prev = candles[i - 1]!;
    trs.push(
      Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close)),
    );
  }
  return sma(trs, period);
}

export function adx(candles: Candle[], period = 14) {
  if (candles.length < period + 2) return NaN;
  const plus: number[] = [];
  const minus: number[] = [];
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]!;
    const p = candles[i - 1]!;
    const up = c.high - p.high;
    const down = p.low - c.low;
    plus.push(up > down && up > 0 ? up : 0);
    minus.push(down > up && down > 0 ? down : 0);
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
  }
  const trSum = sma(trs, period) || 1;
  const pdi = (sma(plus, period) / trSum) * 100;
  const mdi = (sma(minus, period) / trSum) * 100;
  const denom = pdi + mdi;
  return denom === 0 ? 0 : (Math.abs(pdi - mdi) / denom) * 100;
}

export function bollinger(closes: number[], period = 20, mult = 2) {
  const mid = sma(closes, period);
  const sd = stdDev(closes.slice(-period));
  return { upper: mid + mult * sd, middle: mid, lower: mid - mult * sd, width: (4 * sd) / (mid || 1) };
}

export function vwap(candles: Candle[], period = 20) {
  const slice = candles.slice(-period);
  let pv = 0;
  let vol = 0;
  for (const c of slice) {
    const typical = (c.high + c.low + c.close) / 3;
    pv += typical * (c.volume || 1);
    vol += c.volume || 1;
  }
  return vol > 0 ? pv / vol : NaN;
}

export function superTrend(candles: Candle[], period = 10, mult = 3) {
  const a = atr(candles, period);
  const last = candles.at(-1);
  if (!last || !Number.isFinite(a)) return { value: NaN, direction: "neutral" as const };
  const basis = (last.high + last.low) / 2;
  const upper = basis + mult * a;
  const lower = basis - mult * a;
  const direction = last.close >= basis ? ("bullish" as const) : ("bearish" as const);
  return { value: direction === "bullish" ? lower : upper, direction };
}

export function supportResistance(candles: Candle[]) {
  const slice = candles.slice(-120);
  if (slice.length < 10) return { support: [] as number[], resistance: [] as number[] };
  const price = slice.at(-1)!.close;
  const lows = slice.map((c) => c.low).filter((v) => v < price);
  const highs = slice.map((c) => c.high).filter((v) => v > price);
  const pick = (arr: number[], nearestFirst: boolean) => {
    const sorted = [...new Set(arr.map((v) => Math.round(v * 100) / 100))].sort((x, y) =>
      nearestFirst ? y - x : x - y,
    );
    return sorted.slice(0, 3);
  };
  return { support: pick(lows, true), resistance: pick(highs, false) };
}

export function candlePattern(candles: Candle[]) {
  const c = candles.at(-1);
  const p = candles.at(-2);
  if (!c || !p) return "Not enough data";
  const body = Math.abs(c.close - (p.close ?? c.close));
  const range = Math.max(c.high - c.low, 0.0001);
  const upper = c.high - Math.max(c.close, p.close);
  const lower = Math.min(c.close, p.close) - c.low;
  if (body / range < 0.1) return "Doji — indecision between buyers and sellers";
  if (c.close > p.close && lower > body * 2) return "Hammer-like — buyers defended lower levels";
  if (c.close < p.close && upper > body * 2) return "Shooting-star-like — sellers capped the rally";
  if (c.close > p.high) return "Bullish engulfing / gap-up close above the prior high";
  if (c.close < p.low) return "Bearish breakdown below the prior day's low";
  return c.close >= p.close ? "Positive continuation candle" : "Negative continuation candle";
}

export type Technicals = ReturnType<typeof computeTechnicals>;

export function computeTechnicals(candles: Candle[]) {
  const closes = candles.map((c) => c.close);
  const price = closes.at(-1) ?? NaN;
  const returns = dailyReturns(closes);
  const vol = stdDev(returns.slice(-60)) * Math.sqrt(252) * 100;
  const macdValue = macd(closes);
  const rsiValue = rsi(closes);
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);
  const st = superTrend(candles);
  const adxValue = adx(candles);
  const bb = bollinger(closes);
  const levels = supportResistance(candles);
  const high52 = Math.max(...closes.slice(-252));
  const low52 = Math.min(...closes.slice(-252));

  const aboveSma50 = Number.isFinite(sma50) && price > sma50;
  const aboveSma200 = Number.isFinite(sma200) && price > sma200;

  const trendStrength = Math.round(
    clamp(
      (Number.isFinite(adxValue) ? adxValue * 1.6 : 40) +
        (aboveSma50 ? 12 : -12) +
        (aboveSma200 ? 12 : -12),
    ),
  );
  const momentumScore = Math.round(
    clamp(
      (Number.isFinite(rsiValue) ? rsiValue : 50) * 0.7 +
        (macdValue.histogram > 0 ? 20 : 0) +
        (st.direction === "bullish" ? 10 : 0),
    ),
  );
  const volatilityScore = Math.round(clamp(vol * 1.6));
  const riskScore = Math.round(clamp(volatilityScore * 0.6 + (aboveSma200 ? 0 : 25) + (rsiValue > 75 ? 15 : 0)));
  const breakout = Number.isFinite(high52) && price >= high52 * 0.98 && macdValue.histogram > 0;

  return {
    price,
    rsi: rsiValue,
    macd: macdValue,
    sma20: sma(closes, 20),
    sma50,
    sma200,
    ema12: ema(closes, 12),
    ema26: ema(closes, 26),
    ema50: ema(closes, 50),
    vwap: vwap(candles),
    atr: atr(candles),
    adx: adxValue,
    superTrend: st,
    bollinger: bb,
    support: levels.support,
    resistance: levels.resistance,
    trendStrength,
    momentumScore,
    volatilityScore,
    riskScore,
    breakout,
    pattern: candlePattern(candles),
    annualVolatility: vol,
    high52,
    low52,
    aboveSma50,
    aboveSma200,
  };
}

/* ---------------- Historical performance ---------------- */

export function cagr(candles: Candle[], years: number) {
  const days = Math.round(years * 252);
  if (candles.length < days + 1) return NaN;
  const start = candles.at(-days - 1)!.close;
  const end = candles.at(-1)!.close;
  if (start <= 0) return NaN;
  return ((end / start) ** (1 / years) - 1) * 100;
}

export function drawdownProfile(candles: Candle[]) {
  let peak = -Infinity;
  let maxDd = 0;
  let peakIndex = 0;
  let troughIndex = 0;
  let currentDd = 0;
  const series: { date: string; drawdown: number }[] = [];
  candles.forEach((c, i) => {
    if (c.close > peak) {
      peak = c.close;
      peakIndex = i;
    }
    const dd = ((c.close - peak) / peak) * 100;
    if (dd < maxDd) {
      maxDd = dd;
      troughIndex = i;
    }
    currentDd = dd;
    series.push({ date: c.date, drawdown: Number(dd.toFixed(2)) });
  });
  return {
    maxDrawdown: maxDd,
    currentDrawdown: currentDd,
    declineDays: Math.max(0, troughIndex - peakIndex),
    series,
  };
}

export function rollingReturns(candles: Candle[], window: number) {
  const out: { date: string; ret: number }[] = [];
  for (let i = window; i < candles.length; i += 5) {
    const start = candles[i - window]!.close;
    const end = candles[i]!.close;
    if (start > 0) out.push({ date: candles[i]!.date, ret: Number((((end - start) / start) * 100).toFixed(2)) });
  }
  return out;
}

/* ---------------- Forecast engine ---------------- */

export type ForecastHorizon = {
  key: string;
  label: string;
  days: number;
  low: number;
  base: number;
  high: number;
  bullish: number;
  neutral: number;
  bearish: number;
  confidence: number;
  volatility: number;
  cagr: number;
  direction: "Bullish" | "Neutral" | "Bearish";
};

const HORIZONS = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
  { key: "1y", label: "1 year", days: 252 },
  { key: "3y", label: "3 years", days: 756 },
  { key: "5y", label: "5 years", days: 1260 },
];

function erf(x: number) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

function normalCdf(x: number) {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

/**
 * Probability-based projection from log-return drift and volatility, damped for
 * long horizons and blended toward a long-run market drift. Scenario ranges are
 * one standard deviation of the modelled distribution — not a promise.
 */
export function forecastHorizons(candles: Candle[], tech: Technicals): ForecastHorizon[] {
  const closes = candles.map((c) => c.close);
  const price = closes.at(-1) ?? NaN;
  const rets = dailyReturns(closes).map((r) => Math.log(1 + r));
  if (!Number.isFinite(price) || rets.length < 30) return [];
  const mu = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sigma = stdDev(rets) || 0.01;
  const longRunDrift = 0.10 / 252; // ~10% nominal long-run equity drift

  return HORIZONS.map((h) => {
    const blend = Math.min(1, h.days / 504);
    const drift = mu * (1 - blend) * 0.6 + longRunDrift * blend;
    const expected = drift * h.days;
    const sd = sigma * Math.sqrt(h.days);
    const base = price * Math.exp(expected);
    const low = price * Math.exp(expected - sd);
    const high = price * Math.exp(expected + sd);
    const upThreshold = 0.02 * Math.sqrt(h.days / 30);
    const bullish = 1 - normalCdf((upThreshold - expected) / sd);
    const bearish = normalCdf((-upThreshold - expected) / sd);
    const neutral = Math.max(0, 1 - bullish - bearish);
    const confidence = Math.round(
      clamp(
        70 - sd * 120 + (tech.trendStrength - 50) * 0.2 - (h.days > 252 ? 12 : 0),
        25,
        92,
      ),
    );
    const years = h.days / 252;
    return {
      ...h,
      low,
      base,
      high,
      bullish: Math.round(bullish * 100),
      neutral: Math.round(neutral * 100),
      bearish: Math.round(bearish * 100),
      confidence,
      volatility: sigma * Math.sqrt(252) * 100,
      cagr: years >= 1 ? ((base / price) ** (1 / years) - 1) * 100 : NaN,
      direction: bullish > bearish + 10 ? "Bullish" : bearish > bullish + 10 ? "Bearish" : "Neutral",
    };
  });
}

export function forecastBand(candles: Candle[], horizon: ForecastHorizon) {
  const history = candles.slice(-180).map((c) => ({
    date: c.date,
    close: Number(c.close.toFixed(2)),
  }));
  const price = candles.at(-1)?.close ?? 0;
  const steps = 24;
  const projected: {
    date: string;
    base: number;
    low: number;
    high: number;
  }[] = [];
  for (let i = 1; i <= steps; i++) {
    const f = i / steps;
    projected.push({
      date: `+${Math.round((horizon.days * f) / 1)}d`,
      base: Number((price + (horizon.base - price) * f).toFixed(2)),
      low: Number((price + (horizon.low - price) * Math.sqrt(f)).toFixed(2)),
      high: Number((price + (horizon.high - price) * Math.sqrt(f)).toFixed(2)),
    });
  }
  return { history, projected };
}