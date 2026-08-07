import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SectionCard } from "@/components/wealth/StatCard";
import {
  AiNotice,
  DataSource,
  Pill,
  ScoreBar,
  Sparkline,
  SkeletonGrid,
} from "@/components/market/MarketWidgets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStockBoard } from "@/hooks/useMarketData";
import {
  SECTORS,
  formatPct,
  formatPrice,
  formatVolume,
  toneFor,
  type ScoredStock,
} from "@/lib/market";

export const Route = createFileRoute("/_authenticated/discovery")({
  head: () => ({
    meta: [
      { title: "AI Stock Discovery — AI Wealth OS" },
      {
        name: "description",
        content:
          "Rank liquid Indian stocks by an explainable AI Opportunity Score built from live price, trend, volatility and volume data.",
      },
      { property: "og:title", content: "AI Stock Discovery — AI Wealth OS" },
      {
        property: "og:description",
        content: "Explainable opportunity scores, never profit promises.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DiscoveryPage,
});

type Filters = {
  sector: string;
  minOpportunity: number;
  maxRisk: number;
  minMomentum: number;
  minMonth: number;
  search: string;
};

const DEFAULTS: Filters = {
  sector: "All",
  minOpportunity: 0,
  maxRisk: 100,
  minMomentum: 0,
  minMonth: -100,
  search: "",
};

function DiscoveryPage() {
  const board = useStockBoard();
  const [filters, setFilters] = useState<Filters>(DEFAULTS);
  const [expanded, setExpanded] = useState<string | null>(null);

  const stocks = useMemo(() => {
    const list = board.data?.stocks ?? [];
    return list
      .filter((s) => (filters.sector === "All" ? true : s.sector === filters.sector))
      .filter((s) => s.opportunity >= filters.minOpportunity)
      .filter((s) => s.risk <= filters.maxRisk)
      .filter((s) => s.momentum >= filters.minMomentum)
      .filter((s) => s.monthPct >= filters.minMonth)
      .filter((s) =>
        filters.search
          ? `${s.name} ${s.symbol}`.toLowerCase().includes(filters.search.toLowerCase())
          : true,
      )
      .sort((a, b) => b.opportunity - a.opportunity);
  }, [board.data, filters]);

  return (
    <AppShell
      title="AI Stock Discovery"
      description="Opportunity ranking and market scanner across a liquid NSE universe."
      actions={<DataSource label="Yahoo Finance (live prices)" />}
    >
      <SectionCard
        title="Market scanner"
        description="Filter the universe, then read why each name ranks where it does."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Search</span>
            <Input
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Company or ticker"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Sector</span>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={filters.sector}
              onChange={(e) => setFilters({ ...filters, sector: e.target.value })}
            >
              <option>All</option>
              {SECTORS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          {[
            {
              key: "minOpportunity",
              label: `Min opportunity score: ${filters.minOpportunity}`,
              min: 0,
              max: 100,
            },
            { key: "maxRisk", label: `Max risk score: ${filters.maxRisk}`, min: 0, max: 100 },
            { key: "minMomentum", label: `Min momentum: ${filters.minMomentum}`, min: 0, max: 100 },
            { key: "minMonth", label: `Min 1M return: ${filters.minMonth}%`, min: -50, max: 50 },
          ].map((slider) => (
            <label key={slider.key} className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">{slider.label}</span>
              <input
                type="range"
                className="w-full accent-[var(--color-primary)]"
                min={slider.min}
                max={slider.max}
                value={filters[slider.key as keyof Filters] as number}
                onChange={(e) =>
                  setFilters({ ...filters, [slider.key]: Number(e.target.value) } as Filters)
                }
              />
            </label>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setFilters(DEFAULTS)}>
            Reset filters
          </Button>
          <p className="text-xs text-muted-foreground">{stocks.length} matches</p>
        </div>
      </SectionCard>

      {board.isLoading ? <SkeletonGrid /> : null}

      <SectionCard
        title="Ranked by AI Opportunity Score"
        description="Scores are computed from live price action, trend position, volatility and liquidity. They describe conditions — they are not buy recommendations."
      >
        <div className="space-y-3">
          {stocks.map((stock) => (
            <StockRow
              key={stock.symbol}
              stock={stock}
              open={expanded === stock.symbol}
              onToggle={() => setExpanded(expanded === stock.symbol ? null : stock.symbol)}
            />
          ))}
          {!board.isLoading && stocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stocks match these filters.</p>
          ) : null}
        </div>
        <div className="mt-4">
          <AiNotice>
            Scores are deterministic and derived from live Yahoo Finance data. Fundamental ratios
            (PE, PB, ROE, ROCE, debt/equity, growth, dividend yield) are covered as clearly labelled
            estimates inside the AI Research Center. Nothing here guarantees profit.
          </AiNotice>
        </div>
      </SectionCard>
    </AppShell>
  );
}

function StockRow({
  stock,
  open,
  onToggle,
}: {
  stock: ScoredStock;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{stock.name}</p>
            <Pill>{stock.symbol}</Pill>
            <Pill tone="brand">{stock.sector}</Pill>
            <Pill
              tone={
                stock.trend === "Uptrend"
                  ? "positive"
                  : stock.trend === "Downtrend"
                    ? "negative"
                    : "neutral"
              }
            >
              {stock.trend}
            </Pill>
          </div>
          <p className="num mt-1 text-lg font-semibold">
            {formatPrice(stock.price, stock.currency)}{" "}
            <span className={`text-sm ${toneFor(stock.changePct)}`}>
              {formatPct(stock.changePct)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-28">
            <Sparkline values={stock.spark} positive={stock.monthPct >= 0} />
          </div>
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">Opportunity</p>
            <p className="num text-2xl font-semibold text-primary">{stock.opportunity}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onToggle}>
            {open ? "Hide" : "Why?"}
          </Button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 text-xs text-muted-foreground sm:grid-cols-3 lg:grid-cols-6">
        <span>
          1W <span className={toneFor(stock.weekPct)}>{formatPct(stock.weekPct)}</span>
        </span>
        <span>
          1M <span className={toneFor(stock.monthPct)}>{formatPct(stock.monthPct)}</span>
        </span>
        <span>52w high {formatPrice(stock.high52, stock.currency)}</span>
        <span>52w low {formatPrice(stock.low52, stock.currency)}</span>
        <span>Volume {formatVolume(stock.volume)}</span>
        <span>Vol vs avg {stock.volumeRatio.toFixed(2)}x</span>
      </div>

      {open ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <ScoreBar label="Momentum" value={stock.momentum} />
            <ScoreBar label="Growth" value={stock.growth} />
            <ScoreBar label="Valuation proxy" value={stock.value} />
            <ScoreBar label="Risk" value={stock.risk} />
            <ScoreBar label="Overall opportunity" value={stock.opportunity} />
          </div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {stock.reasons.map((reason) => (
              <li key={reason} className="flex gap-2">
                <span className="text-primary">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
