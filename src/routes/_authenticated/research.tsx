import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Sparkles } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { SectionCard } from "@/components/wealth/StatCard";
import {
  AiNotice,
  Bullets,
  DataSource,
  Meter,
  Metric,
  Pill,
  formatCompact,
  formatPercentValue,
  formatRatio,
} from "@/components/market/MarketWidgets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStockDossier, useSymbolSearch } from "@/hooks/useMarketData";
import {
  explainForecast,
  interpretChart,
  longTermReport,
  valuationLab,
} from "@/lib/ai.functions";
import { formatPct, formatPrice, toneFor } from "@/lib/market";
import {
  cagr,
  computeTechnicals,
  drawdownProfile,
  forecastBand,
  forecastHorizons,
  type Candle,
} from "@/lib/technicals";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/research")({
  head: () => ({
    meta: [
      { title: "AI Stock Research Center — AI Wealth OS" },
      {
        name: "description",
        content:
          "Search any stock for live fundamentals, an explainable opportunity score, a technical terminal, valuation lab and probability-based AI forecasts.",
      },
      { property: "og:title", content: "AI Stock Research Center — AI Wealth OS" },
      {
        property: "og:description",
        content: "Fundamentals, technicals, valuation and probability forecasts in one terminal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResearchPage,
});

function ResearchPage() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState({ symbol: "RELIANCE.NS", name: "Reliance Industries" });
  const search = useSymbolSearch(query);
  const dossier = useStockDossier(selected.symbol, selected.name);

  const candles = useMemo(() => (dossier.data?.candles ?? []) as Candle[], [dossier.data]);
  const quote = dossier.data?.quote;
  const fundamentals = dossier.data?.fundamentals;
  const currency = quote?.currency ?? "INR";

  const tech = useMemo(() => (candles.length > 30 ? computeTechnicals(candles) : null), [candles]);
  const forecasts = useMemo(
    () => (tech && candles.length > 60 ? forecastHorizons(candles, tech) : []),
    [candles, tech],
  );
  const [horizonKey, setHorizonKey] = useState("30d");
  const horizon = forecasts.find((f) => f.key === horizonKey) ?? forecasts[0];
  const band = useMemo(
    () => (horizon ? forecastBand(candles, horizon) : null),
    [candles, horizon],
  );
  const dd = useMemo(() => (candles.length > 30 ? drawdownProfile(candles) : null), [candles]);

  const context = useMemo(() => {
    if (!quote || !tech) return "";
    return JSON.stringify({
      symbol: selected.symbol,
      name: quote.name,
      currency,
      price: quote.price,
      changePct: quote.changePct,
      weekPct: quote.weekPct,
      monthPct: quote.monthPct,
      high52: tech.high52,
      low52: tech.low52,
      technicals: {
        rsi: tech.rsi,
        macd: tech.macd,
        sma50: tech.sma50,
        sma200: tech.sma200,
        adx: tech.adx,
        atr: tech.atr,
        vwap: tech.vwap,
        superTrend: tech.superTrend,
        bollinger: tech.bollinger,
        support: tech.support,
        resistance: tech.resistance,
        pattern: tech.pattern,
        annualVolatility: tech.annualVolatility,
      },
      cagr: { y1: cagr(candles, 1), y3: cagr(candles, 3), y5: cagr(candles, 5) },
      drawdown: dd ? { max: dd.maxDrawdown, current: dd.currentDrawdown } : null,
      fundamentals: fundamentals?.available ? fundamentals : "live fundamentals unavailable",
      forecasts,
      recentHeadlines: (dossier.data?.news ?? []).map((n) => n.title),
    });
  }, [quote, tech, selected.symbol, currency, candles, dd, fundamentals, forecasts, dossier.data]);

  const chartFn = useServerFn(interpretChart);
  const reportFn = useServerFn(longTermReport);
  const valuationFn = useServerFn(valuationLab);
  const forecastFn = useServerFn(explainForecast);

  const chartRead = useMutation({ mutationFn: () => chartFn({ data: { context } }) });
  const report = useMutation({ mutationFn: () => reportFn({ data: { context } }) });
  const valuation = useMutation({ mutationFn: () => valuationFn({ data: { context } }) });
  const forecastNote = useMutation({ mutationFn: () => forecastFn({ data: { context } }) });

  const priceSeries = candles.slice(-260).map((c) => ({ date: c.date, close: c.close }));

  return (
    <AppShell
      title="AI Research Center"
      description="Search any listed company for live data, explainable scores and AI research."
    >
      <div className="space-y-5">
        <SectionCard title="Search a company" description="NSE, BSE or global tickers.">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Try Reliance, TCS, AAPL…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          {search.data?.results?.length ? (
            <ul className="mt-3 divide-y divide-border/60">
              {search.data.results.slice(0, 6).map((r) => (
                <li key={r.symbol}>
                  <button
                    className="flex w-full items-center justify-between gap-3 px-2 py-2 text-left text-sm hover:bg-muted/50"
                    onClick={() => {
                      setSelected({ symbol: r.symbol, name: r.name });
                      setQuery("");
                      chartRead.reset();
                      report.reset();
                      valuation.reset();
                      forecastNote.reset();
                    }}
                  >
                    <span className="truncate">{r.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {r.symbol} · {r.exchange}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </SectionCard>

        {dossier.isLoading ? (
          <div className="surface h-64 animate-pulse bg-muted/40" />
        ) : !quote || !tech ? (
          <SectionCard title="No live data">
            <p className="text-sm text-muted-foreground">
              Live data for this symbol is unavailable right now. Try another ticker or refresh.
            </p>
          </SectionCard>
        ) : (
          <>
            <SectionCard
              title={`${quote.name} (${selected.symbol})`}
              description={
                fundamentals?.available
                  ? `${fundamentals.sector || "—"} · ${fundamentals.industry || "—"}`
                  : "Sector data unavailable live"
              }
              actions={<Pill tone={quote.changePct >= 0 ? "positive" : "negative"}>{formatPct(quote.changePct)}</Pill>}
            >
              <div className="flex flex-wrap items-end gap-6">
                <div>
                  <p className="num text-3xl font-semibold">{formatPrice(quote.price, currency)}</p>
                  <p className={cn("num text-sm", toneFor(quote.changePct))}>
                    1W {formatPct(quote.weekPct)} · 1M {formatPct(quote.monthPct)}
                  </p>
                </div>
                <div className="grid flex-1 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  <Metric label="Market cap" value={formatCompact(fundamentals?.marketCap ?? null, currency)} />
                  <Metric label="Enterprise value" value={formatCompact(fundamentals?.enterpriseValue ?? null, currency)} />
                  <Metric label="52W high" value={formatPrice(tech.high52, currency)} />
                  <Metric label="52W low" value={formatPrice(tech.low52, currency)} />
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Fundamentals"
              description={
                fundamentals?.available
                  ? "Live from Yahoo Finance company data."
                  : "Live fundamentals feed is throttled right now — figures show as unavailable rather than guessed."
              }
            >
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                <Metric label="P/E" value={formatRatio(fundamentals?.trailingPE)} />
                <Metric label="Forward P/E" value={formatRatio(fundamentals?.forwardPE)} />
                <Metric label="PEG" value={formatRatio(fundamentals?.pegRatio)} />
                <Metric label="EPS" value={formatRatio(fundamentals?.eps)} />
                <Metric label="Book value" value={formatRatio(fundamentals?.bookValue)} />
                <Metric label="Price / Book" value={formatRatio(fundamentals?.priceToBook)} />
                <Metric label="ROE" value={formatPercentValue(fundamentals?.roe)} />
                <Metric label="Return on assets" value={formatPercentValue(fundamentals?.roa)} />
                <Metric label="Debt / Equity" value={formatRatio(fundamentals?.debtToEquity)} />
                <Metric label="Current ratio" value={formatRatio(fundamentals?.currentRatio)} />
                <Metric label="Quick ratio" value={formatRatio(fundamentals?.quickRatio)} />
                <Metric label="Dividend yield" value={formatPercentValue(fundamentals?.dividendYield)} />
                <Metric label="Revenue growth" value={formatPercentValue(fundamentals?.revenueGrowth)} />
                <Metric label="Earnings growth" value={formatPercentValue(fundamentals?.earningsGrowth)} />
                <Metric label="Operating margin" value={formatPercentValue(fundamentals?.operatingMargin)} />
                <Metric label="Net margin" value={formatPercentValue(fundamentals?.profitMargin)} />
                <Metric label="EBITDA margin" value={formatPercentValue(fundamentals?.ebitdaMargin)} />
                <Metric label="Free cash flow" value={formatCompact(fundamentals?.freeCashflow ?? null, currency)} />
                <Metric label="Cash position" value={formatCompact(fundamentals?.totalCash ?? null, currency)} />
                <Metric label="Total debt" value={formatCompact(fundamentals?.totalDebt ?? null, currency)} />
                <Metric label="Revenue" value={formatCompact(fundamentals?.totalRevenue ?? null, currency)} />
                <Metric label="EBITDA" value={formatCompact(fundamentals?.ebitda ?? null, currency)} />
                <Metric label="Promoter / insider holding" value={formatPercentValue(fundamentals?.heldPercentInsiders)} />
                <Metric label="Institutional holding" value={formatPercentValue(fundamentals?.heldPercentInstitutions)} />
                <Metric label="Beta" value={formatRatio(fundamentals?.beta)} />
                <Metric
                  label="Analyst consensus"
                  value={fundamentals?.recommendationKey ? fundamentals.recommendationKey.replace("_", " ") : "—"}
                  hint={
                    fundamentals?.numberOfAnalysts
                      ? `${fundamentals.numberOfAnalysts} analysts · target ${formatPrice(
                          fundamentals.targetMeanPrice ?? NaN,
                          currency,
                        )}`
                      : undefined
                  }
                />
              </div>
            </SectionCard>

            <div className="grid gap-4 xl:grid-cols-2">
              <SectionCard title="Technical terminal" description="Computed from 5 years of daily candles.">
                <div className="grid gap-2 sm:grid-cols-3">
                  <Metric label="RSI (14)" value={formatRatio(tech.rsi, 1)} />
                  <Metric label="MACD" value={formatRatio(tech.macd.macd)} hint={`Signal ${formatRatio(tech.macd.signal)}`} />
                  <Metric label="ADX" value={formatRatio(tech.adx, 1)} />
                  <Metric label="SMA 20 / 50" value={`${formatRatio(tech.sma20, 0)} / ${formatRatio(tech.sma50, 0)}`} />
                  <Metric label="SMA 200" value={formatRatio(tech.sma200, 0)} />
                  <Metric label="EMA 12 / 26" value={`${formatRatio(tech.ema12, 0)} / ${formatRatio(tech.ema26, 0)}`} />
                  <Metric label="VWAP (20d)" value={formatRatio(tech.vwap, 0)} />
                  <Metric label="ATR (14)" value={formatRatio(tech.atr)} />
                  <Metric label="SuperTrend" value={tech.superTrend.direction} hint={formatRatio(tech.superTrend.value, 0)} />
                  <Metric
                    label="Bollinger"
                    value={`${formatRatio(tech.bollinger.lower, 0)} – ${formatRatio(tech.bollinger.upper, 0)}`}
                  />
                  <Metric label="Support" value={tech.support.map((s) => s.toFixed(0)).join(" · ") || "—"} />
                  <Metric label="Resistance" value={tech.resistance.map((s) => s.toFixed(0)).join(" · ") || "—"} />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  <Meter label="Trend" value={tech.trendStrength} />
                  <Meter label="Momentum" value={tech.momentumScore} tone="positive" />
                  <Meter label="Volatility" value={tech.volatilityScore} tone="warning" />
                  <Meter label="Risk" value={tech.riskScore} tone="negative" />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Pattern read: {tech.pattern}
                  {tech.breakout ? " · Breakout conditions detected near the 52-week high." : ""}
                </p>
                <Button
                  className="mt-3"
                  size="sm"
                  onClick={() => chartRead.mutate()}
                  disabled={chartRead.isPending}
                >
                  <Sparkles className="mr-1.5 size-3.5" />
                  {chartRead.isPending ? "Reading chart…" : "AI chart interpretation"}
                </Button>
                {chartRead.data ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm">{chartRead.data.plainEnglish}</p>
                    <Bullets title="Observations" items={chartRead.data.observations} />
                    <p className="text-xs text-muted-foreground">{chartRead.data.caution}</p>
                  </div>
                ) : null}
                {chartRead.error ? (
                  <p className="mt-2 text-xs text-destructive">{(chartRead.error as Error).message}</p>
                ) : null}
              </SectionCard>

              <SectionCard title="Price & drawdown history" description="Last 12 months of closes, plus the full drawdown profile.">
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={priceSeries}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="date" hide />
                      <YAxis domain={["auto", "auto"]} width={52} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="close" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.12} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  <Metric label="1Y CAGR" value={`${formatRatio(cagr(candles, 1), 1)}%`} />
                  <Metric label="3Y CAGR" value={`${formatRatio(cagr(candles, 3), 1)}%`} />
                  <Metric label="5Y CAGR" value={`${formatRatio(cagr(candles, 5), 1)}%`} />
                  <Metric label="Annual volatility" value={`${formatRatio(tech.annualVolatility, 1)}%`} />
                </div>
                {dd ? (
                  <div className="mt-3 h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dd.series.slice(-750)}>
                        <XAxis dataKey="date" hide />
                        <YAxis width={44} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="drawdown" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : null}
                {dd ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Max drawdown {dd.maxDrawdown.toFixed(1)}% · currently {dd.currentDrawdown.toFixed(1)}% below peak.
                  </p>
                ) : null}
              </SectionCard>
            </div>

            <SectionCard
              title="AI Forecast Engine"
              description="Probability ranges from a drift-and-volatility model on live prices — scenarios, not predictions."
            >
              <div className="flex flex-wrap gap-2">
                {forecasts.map((f) => (
                  <Button
                    key={f.key}
                    size="sm"
                    variant={f.key === horizon?.key ? "default" : "outline"}
                    onClick={() => setHorizonKey(f.key)}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>
              {horizon ? (
                <>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    <Metric
                      label="Expected range"
                      value={`${formatPrice(horizon.low, currency)} – ${formatPrice(horizon.high, currency)}`}
                      hint={`Base ${formatPrice(horizon.base, currency)}`}
                    />
                    <Metric label="Bullish" value={`${horizon.bullish}%`} />
                    <Metric label="Neutral" value={`${horizon.neutral}%`} />
                    <Metric label="Bearish" value={`${horizon.bearish}%`} />
                    <Metric label="Confidence" value={`${horizon.confidence}/100`} />
                    <Metric
                      label="Expected volatility"
                      value={`${horizon.volatility.toFixed(1)}%`}
                      hint={Number.isFinite(horizon.cagr) ? `Implied CAGR ${horizon.cagr.toFixed(1)}%` : undefined}
                    />
                  </div>
                  {band ? (
                    <div className="mt-4 h-60">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={band.projected}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis domain={["auto", "auto"]} width={56} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Area type="monotone" dataKey="high" stroke="none" fill="var(--color-primary)" fillOpacity={0.12} />
                          <Area type="monotone" dataKey="low" stroke="none" fill="var(--color-background)" fillOpacity={0.9} />
                          <Line type="monotone" dataKey="base" stroke="var(--color-primary)" dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : null}
                  <Button
                    className="mt-3"
                    size="sm"
                    onClick={() => forecastNote.mutate()}
                    disabled={forecastNote.isPending}
                  >
                    <Sparkles className="mr-1.5 size-3.5" />
                    {forecastNote.isPending ? "Analysing…" : "Explain this forecast"}
                  </Button>
                  {forecastNote.data ? (
                    <div className="mt-3 space-y-3 text-sm">
                      <p>{forecastNote.data.summary}</p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Metric label="Best case" value="" hint={forecastNote.data.bestCase} />
                        <Metric label="Base case" value="" hint={forecastNote.data.baseCase} />
                        <Metric label="Worst case" value="" hint={forecastNote.data.worstCase} />
                      </div>
                      <Bullets
                        title="Key factors"
                        items={forecastNote.data.keyFactors.map((k) => `${k.factor}: ${k.effect}`)}
                      />
                      <Bullets title="What would change it" items={forecastNote.data.whatWouldChangeIt} />
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Not enough history to model this symbol.</p>
              )}
            </SectionCard>

            <div className="grid gap-4 xl:grid-cols-2">
              <SectionCard title="Valuation lab" description="DCF sketch, multiples and margin of safety.">
                <Button size="sm" onClick={() => valuation.mutate()} disabled={valuation.isPending}>
                  <Sparkles className="mr-1.5 size-3.5" />
                  {valuation.isPending ? "Valuing…" : "Run valuation review"}
                </Button>
                {valuation.data ? (
                  <div className="mt-3 space-y-2 text-sm">
                    <Pill tone="brand">{valuation.data.verdict}</Pill>
                    <p>{valuation.data.verdictReason}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Metric label="Intrinsic value" value="" hint={valuation.data.intrinsicValue} />
                      <Metric label="Margin of safety" value="" hint={valuation.data.marginOfSafety} />
                      <Metric label="DCF" value="" hint={valuation.data.dcf} />
                      <Metric label="P/E comparison" value="" hint={valuation.data.peComparison} />
                      <Metric label="EV / EBITDA" value="" hint={valuation.data.evEbitda} />
                      <Metric label="PEG" value="" hint={valuation.data.peg} />
                      <Metric label="Historical band" value="" hint={valuation.data.historicalValuation} />
                      <Metric label="Sector comparison" value="" hint={valuation.data.sectorComparison} />
                    </div>
                    <Bullets title="Assumptions" items={valuation.data.assumptions} />
                  </div>
                ) : null}
              </SectionCard>

              <SectionCard title="Long-term investment analysis" description="AI research note across quality, moat and risk.">
                <Button size="sm" onClick={() => report.mutate()} disabled={report.isPending}>
                  <Sparkles className="mr-1.5 size-3.5" />
                  {report.isPending ? "Writing…" : "Generate research note"}
                </Button>
                {report.data ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Metric label="Business quality" value="" hint={report.data.businessQuality} />
                    <Metric label="Management" value="" hint={report.data.managementQuality} />
                    <Metric label="Competitive advantage" value="" hint={report.data.competitiveAdvantage} />
                    <Metric label="Financial strength" value="" hint={report.data.financialStrength} />
                    <Metric label="Growth potential" value="" hint={report.data.growthPotential} />
                    <Metric label="Innovation" value="" hint={report.data.innovation} />
                    <Metric label="Risk level" value="" hint={report.data.riskLevel} />
                    <Metric label="Historical consistency" value="" hint={report.data.historicalConsistency} />
                    <Metric label="Sector outlook" value="" hint={report.data.sectorOutlook} />
                    <Metric label="Valuation" value="" hint={report.data.valuationAnalysis} />
                    <div className="sm:col-span-2">
                      <Bullets title="Growth drivers" items={report.data.futureGrowthDrivers} />
                      <div className="mt-2">
                        <Bullets title="Challenges" items={report.data.potentialChallenges} />
                      </div>
                      <p className="mt-2 text-sm">{report.data.investmentThesis}</p>
                    </div>
                  </div>
                ) : null}
              </SectionCard>
            </div>

            {dossier.data?.news?.length ? (
              <SectionCard title="Recent headlines" description="Company news from the last two weeks.">
                <ul className="divide-y divide-border/60">
                  {dossier.data.news.map((n) => (
                    <li key={n.id} className="py-2">
                      <a className="text-sm hover:underline" href={n.link} target="_blank" rel="noreferrer">
                        {n.title}
                      </a>
                      <p className="text-[11px] text-muted-foreground">{n.source}</p>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            ) : null}
          </>
        )}

        <DataSource label="Yahoo Finance (prices, fundamentals) · Google News aggregation (headlines)" />
        <AiNotice />
      </div>
    </AppShell>
  );
}