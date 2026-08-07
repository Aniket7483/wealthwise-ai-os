import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Flame } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SectionCard } from "@/components/wealth/StatCard";
import {
  AiNotice,
  DataSource,
  Pill,
  SkeletonGrid,
  Sparkline,
} from "@/components/market/MarketWidgets";
import { Button } from "@/components/ui/button";
import { useStockBoard } from "@/hooks/useMarketData";
import { formatPct, formatPrice, formatVolume, toneFor, type ScoredStock } from "@/lib/market";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/trending")({
  head: () => ({
    meta: [
      { title: "Trending Stocks — AI Wealth OS" },
      {
        name: "description",
        content:
          "Live NSE movers: top gainers, losers, high volume, breakouts, 52-week extremes, momentum leaders and value screens.",
      },
      { property: "og:title", content: "Trending Stocks — AI Wealth OS" },
      {
        property: "og:description",
        content: "Live gainers, losers, breakouts and momentum leaders from the NSE universe.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TrendingPage,
});

type BucketKey =
  | "gainers"
  | "losers"
  | "volume"
  | "breakout"
  | "nearHigh"
  | "nearLow"
  | "momentum"
  | "undervalued"
  | "overvalued";

const BUCKETS: { key: BucketKey; label: string; hint: string }[] = [
  { key: "gainers", label: "Top gainers", hint: "Largest positive move today." },
  { key: "losers", label: "Top losers", hint: "Largest negative move today." },
  {
    key: "volume",
    label: "High volume / most active",
    hint: "Today's traded volume versus the 3-month average — the closest public proxy for delivery-heavy activity.",
  },
  {
    key: "breakout",
    label: "Breakout candidates",
    hint: "Within 3% of the 52-week high, rising over the last month on above-average volume.",
  },
  { key: "nearHigh", label: "Near 52-week high", hint: "Trading within 5% of the 52-week high." },
  { key: "nearLow", label: "Near 52-week low", hint: "Trading within 8% of the 52-week low." },
  {
    key: "momentum",
    label: "Strong momentum",
    hint: "Highest blended momentum score from daily, weekly and monthly returns.",
  },
  {
    key: "undervalued",
    label: "Undervalued (screen)",
    hint: "Low position in the 52-week range with contained volatility. A price-based screen, not a valuation call.",
  },
  {
    key: "overvalued",
    label: "Extended / overvalued (screen)",
    hint: "Stretched near the top of the 52-week range after a sharp run.",
  },
];

function bucketFor(key: BucketKey, stocks: ScoredStock[]): ScoredStock[] {
  const list = [...stocks];
  switch (key) {
    case "gainers":
      return list.sort((a, b) => b.changePct - a.changePct).slice(0, 10);
    case "losers":
      return list.sort((a, b) => a.changePct - b.changePct).slice(0, 10);
    case "volume":
      return list.sort((a, b) => b.volumeRatio - a.volumeRatio).slice(0, 10);
    case "breakout":
      return list
        .filter((s) => s.fromHigh > -3 && s.monthPct > 0 && s.volumeRatio >= 1)
        .sort((a, b) => b.monthPct - a.monthPct)
        .slice(0, 10);
    case "nearHigh":
      return list
        .filter((s) => s.fromHigh > -5)
        .sort((a, b) => b.fromHigh - a.fromHigh)
        .slice(0, 10);
    case "nearLow":
      return list
        .filter((s) => s.fromLow < 8)
        .sort((a, b) => a.fromLow - b.fromLow)
        .slice(0, 10);
    case "momentum":
      return list.sort((a, b) => b.momentum - a.momentum).slice(0, 10);
    case "undervalued":
      return list.sort((a, b) => b.value - a.value).slice(0, 10);
    case "overvalued":
      return list.sort((a, b) => a.value - b.value).slice(0, 10);
    default:
      return list.slice(0, 10);
  }
}

function metricFor(key: BucketKey, s: ScoredStock) {
  switch (key) {
    case "volume":
      return `${s.volumeRatio.toFixed(2)}x avg · ${formatVolume(s.volume)}`;
    case "breakout":
    case "nearHigh":
      return `${s.fromHigh.toFixed(1)}% from 52W high`;
    case "nearLow":
      return `${s.fromLow.toFixed(1)}% above 52W low`;
    case "momentum":
      return `Momentum ${s.momentum}/100`;
    case "undervalued":
    case "overvalued":
      return `Value screen ${s.value}/100 · risk ${s.risk}/100`;
    default:
      return `1W ${formatPct(s.weekPct)} · 1M ${formatPct(s.monthPct)}`;
  }
}

function StockRow({ stock, metric }: { stock: ScoredStock; metric: string }) {
  return (
    <li className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{stock.name}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {stock.symbol.replace(".NS", "")} · {stock.sector}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{metric}</p>
      </div>
      <div className="hidden w-24 shrink-0 sm:block">
        <Sparkline values={stock.spark} positive={stock.monthPct >= 0} />
      </div>
      <div className="w-24 shrink-0 text-right">
        <p className="num text-sm font-semibold">{formatPrice(stock.price, stock.currency)}</p>
        <p className={cn("num text-xs font-medium", toneFor(stock.changePct))}>
          {formatPct(stock.changePct)}
        </p>
      </div>
    </li>
  );
}

function TrendingPage() {
  const board = useStockBoard();
  const [active, setActive] = useState<BucketKey | "all">("all");

  const stocks = board.data?.stocks ?? [];
  const visible = useMemo(
    () => (active === "all" ? BUCKETS : BUCKETS.filter((b) => b.key === active)),
    [active],
  );

  return (
    <AppShell
      title="Trending stocks"
      description="Live movers across the tracked NSE universe, grouped into actionable screens."
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={active === "all" ? "default" : "outline"}
            onClick={() => setActive("all")}
          >
            <Flame className="mr-1.5 size-3.5" /> All screens
          </Button>
          {BUCKETS.map((b) => (
            <Button
              key={b.key}
              size="sm"
              variant={active === b.key ? "default" : "outline"}
              onClick={() => setActive(b.key)}
            >
              {b.label}
            </Button>
          ))}
        </div>

        {board.isLoading ? (
          <SkeletonGrid count={6} />
        ) : stocks.length === 0 ? (
          <SectionCard title="No live data">
            <p className="text-sm text-muted-foreground">
              Market data is temporarily unavailable. Try refreshing in a moment.
            </p>
          </SectionCard>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {visible.map((bucket) => {
              const rows = bucketFor(bucket.key, stocks);
              return (
                <SectionCard
                  key={bucket.key}
                  title={bucket.label}
                  actions={<Pill tone="brand">{rows.length}</Pill>}
                >
                  <p className="mb-2 text-[11px] text-muted-foreground">{bucket.hint}</p>
                  {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No stocks match this screen right now.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border/60">
                      {rows.map((s) => (
                        <StockRow key={s.symbol} stock={s} metric={metricFor(bucket.key, s)} />
                      ))}
                    </ul>
                  )}
                </SectionCard>
              );
            })}
          </div>
        )}

        <DataSource label="Yahoo Finance daily price & volume history (live)" />
        <AiNotice>
          Screens are computed from live price and volume data only. Exchange delivery percentage is
          not available in public feeds, so volume-versus-average is used as the activity proxy.
          Informational only — not investment advice.
        </AiNotice>
      </div>
    </AppShell>
  );
}
