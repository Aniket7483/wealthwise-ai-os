import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { GitCompare, X } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState, SectionCard } from "@/components/wealth/StatCard";
import { AiNotice, DataSource, Pill, ScoreBar, Sparkline } from "@/components/market/MarketWidgets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuotesFor } from "@/hooks/useMarketData";
import { compareCompanies, type ComparisonView } from "@/lib/ai.functions";
import { STOCK_UNIVERSE, formatPct, formatPrice, scoreStock, toneFor } from "@/lib/market";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/compare")({
  head: () => ({
    meta: [
      { title: "Company Comparison — AI Wealth OS" },
      {
        name: "description",
        content:
          "Compare up to four companies side by side on price action, momentum, risk, value and AI opportunity scores.",
      },
      { property: "og:title", content: "Company Comparison — AI Wealth OS" },
      {
        property: "og:description",
        content: "Side-by-side company analysis with explainable AI scoring.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ComparePage,
});

const DEFAULTS = ["TCS.NS", "INFY.NS", "HCLTECH.NS"];

function ComparePage() {
  const [picked, setPicked] = useState<string[]>(DEFAULTS);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => picked.flatMap((s) => STOCK_UNIVERSE.filter((u) => u.symbol === s)),
    [picked],
  );
  const quotes = useQuotesFor(selected.map((s) => ({ symbol: s.symbol, name: s.name })));

  const rows = useMemo(() => {
    const list = quotes.data?.quotes ?? [];
    return selected.flatMap((stock) => {
      const q = list.find((x) => x.symbol === stock.symbol);
      if (!q || !Number.isFinite(q.price)) return [];
      return [scoreStock(stock, q)];
    });
  }, [selected, quotes.data]);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return STOCK_UNIVERSE.filter(
      (s) =>
        !picked.includes(s.symbol) &&
        (q.length === 0 || s.name.toLowerCase().includes(q) || s.symbol.toLowerCase().includes(q)),
    ).slice(0, 8);
  }, [query, picked]);

  const chartData = useMemo(
    () =>
      [
        { metric: "Momentum", key: "momentum" as const },
        { metric: "Growth", key: "growth" as const },
        { metric: "Value", key: "value" as const },
        { metric: "Stability", key: "risk" as const },
        { metric: "Opportunity", key: "opportunity" as const },
      ].map(({ metric, key }) => {
        const row: Record<string, string | number> = { metric };
        for (const s of rows) row[s.symbol] = key === "risk" ? 100 - s.risk : s[key];
        return row;
      }),
    [rows],
  );

  const compareFn = useServerFn(compareCompanies);
  const ai = useMutation<ComparisonView>({
    mutationFn: () =>
      compareFn({
        data: {
          context: JSON.stringify(
            rows.map((r) => ({
              symbol: r.symbol,
              name: r.name,
              sector: r.sector,
              price: r.price,
              dayPct: Number(r.changePct.toFixed(2)),
              weekPct: Number(r.weekPct.toFixed(2)),
              monthPct: Number(r.monthPct.toFixed(2)),
              fromHigh: Number(r.fromHigh.toFixed(2)),
              momentum: r.momentum,
              growth: r.growth,
              value: r.value,
              risk: r.risk,
              opportunity: r.opportunity,
              trend: r.trend,
            })),
          ),
        },
      }),
    onError: (e: Error) => toast.error(e.message),
  });

  const colors = ["var(--color-primary)", "#0ea5e9", "#f59e0b", "#8b5cf6"];

  return (
    <AppShell
      title="Company Comparison"
      description="Put companies head to head on live price action and explainable scores."
      actions={
        <Button onClick={() => ai.mutate()} disabled={rows.length < 2 || ai.isPending}>
          <GitCompare className="size-4" />
          {ai.isPending ? "Comparing…" : "AI comparison"}
        </Button>
      }
    >
      <SectionCard
        title="Select companies"
        description="Up to four at a time."
        actions={<DataSource label="Yahoo Finance" />}
      >
        <div className="flex flex-wrap gap-2">
          {selected.map((s) => (
            <button
              key={s.symbol}
              onClick={() => setPicked((p) => p.filter((x) => x !== s.symbol))}
              className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
            >
              {s.name}
              <X className="size-3" />
            </button>
          ))}
          {selected.length === 0 ? (
            <p className="text-sm text-muted-foreground">Pick at least two companies below.</p>
          ) : null}
        </div>
        <div className="mt-4 max-w-sm">
          <Input
            placeholder="Search the NSE universe…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {options.map((o) => (
            <button
              key={o.symbol}
              disabled={picked.length >= 4}
              onClick={() => {
                setPicked((p) => (p.length >= 4 ? p : [...p, o.symbol]));
                setQuery("");
              }}
              className={cn(
                "rounded-full border border-border px-3 py-1 text-xs transition-colors hover:bg-muted",
                picked.length >= 4 && "opacity-40",
              )}
            >
              {o.name}
            </button>
          ))}
        </div>
      </SectionCard>

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing to compare yet"
          description="Select companies to load live comparison data."
        />
      ) : (
        <>
          <SectionCard
            title="Head to head"
            description="Live prices, returns and deterministic scores."
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                    <th className="py-2">Metric</th>
                    {rows.map((r) => (
                      <th key={r.symbol} className="py-2 text-right">
                        {r.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["Price", (r: (typeof rows)[number]) => formatPrice(r.price, r.currency)],
                      ["Today", (r: (typeof rows)[number]) => formatPct(r.changePct)],
                      ["1 week", (r: (typeof rows)[number]) => formatPct(r.weekPct)],
                      ["1 month", (r: (typeof rows)[number]) => formatPct(r.monthPct)],
                      ["From 52w high", (r: (typeof rows)[number]) => formatPct(r.fromHigh)],
                      ["Trend", (r: (typeof rows)[number]) => r.trend],
                      ["Momentum", (r: (typeof rows)[number]) => `${r.momentum}/100`],
                      ["Growth", (r: (typeof rows)[number]) => `${r.growth}/100`],
                      ["Value proxy", (r: (typeof rows)[number]) => `${r.value}/100`],
                      ["Risk", (r: (typeof rows)[number]) => `${r.risk}/100`],
                      ["AI opportunity", (r: (typeof rows)[number]) => `${r.opportunity}/100`],
                    ] as const
                  ).map(([label, render]) => (
                    <tr key={label} className="border-b border-border/50 last:border-0">
                      <td className="py-2 text-muted-foreground">{label}</td>
                      {rows.map((r) => (
                        <td key={r.symbol} className="num py-2 text-right">
                          {render(r)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
            <SectionCard
              title="Score profile"
              description="Higher is better on every axis (risk is shown as stability)."
            >
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="metric"
                      tick={{ fontSize: 11 }}
                      stroke="var(--color-muted-foreground)"
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                      stroke="var(--color-muted-foreground)"
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {rows.map((r, i) => (
                      <Bar
                        key={r.symbol}
                        dataKey={r.symbol}
                        fill={colors[i % colors.length]}
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard title="Trend snapshots" description="Last quarter of closes.">
              <div className="space-y-4">
                {rows.map((r) => (
                  <div key={r.symbol}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{r.name}</span>
                      <span className={cn("num", toneFor(r.monthPct))}>
                        {formatPct(r.monthPct)}
                      </span>
                    </div>
                    <Sparkline values={r.spark} positive={r.monthPct >= 0} />
                    <div className="mt-1 grid grid-cols-2 gap-3">
                      <ScoreBar label="Opportunity" value={r.opportunity} />
                      <ScoreBar label="Momentum" value={r.momentum} />
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </>
      )}

      {ai.data ? (
        <SectionCard title="AI comparison" description={ai.data.summary}>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border/60 bg-card/40 p-3">
              <Pill tone="brand">Best for growth</Pill>
              <p className="mt-2 text-sm">{ai.data.bestForGrowth}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card/40 p-3">
              <Pill tone="brand">Best for stability</Pill>
              <p className="mt-2 text-sm">{ai.data.bestForStability}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card/40 p-3">
              <Pill tone="brand">Best for value</Pill>
              <p className="mt-2 text-sm">{ai.data.bestForValue}</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {ai.data.verdicts.map((v) => (
              <div key={v.symbol} className="rounded-lg border border-border/60 p-3">
                <p className="text-sm font-semibold">{v.symbol}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  <span className="text-foreground">Strengths — </span>
                  {v.strengths}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  <span className="text-foreground">Watch-outs — </span>
                  {v.watchOuts}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <AiNotice>{ai.data.disclaimer}</AiNotice>
          </div>
        </SectionCard>
      ) : null}
    </AppShell>
  );
}
