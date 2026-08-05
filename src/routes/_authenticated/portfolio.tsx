import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2, Sparkle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState, SectionCard, StatCard } from "@/components/wealth/StatCard";
import { AiNotice, Bullets, DataSource, Pill } from "@/components/market/MarketWidgets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHoldingMutations, useHoldings, useQuotesFor } from "@/hooks/useMarketData";
import { advisePortfolio, reviewPortfolio, type PortfolioAlerts, type PortfolioReview } from "@/lib/ai.functions";
import { STOCK_UNIVERSE, formatPct, formatPrice, toneFor } from "@/lib/market";

export const Route = createFileRoute("/_authenticated/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio AI Advisor — AI Wealth OS" },
      {
        name: "description",
        content:
          "Track holdings with live prices, unrealised P&L, allocation and AI monitoring for results, dividends, trend changes and big moves.",
      },
      { property: "og:title", content: "Portfolio AI Advisor — AI Wealth OS" },
      {
        property: "og:description",
        content: "Live portfolio valuation with explainable AI monitoring and risk review.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PortfolioPage,
});

const SLICE_COLORS = [
  "var(--color-primary)",
  "#0ea5e9",
  "#f59e0b",
  "#8b5cf6",
  "#10b981",
  "#f43f5e",
  "#14b8a6",
  "#eab308",
];

function PortfolioPage() {
  const holdings = useHoldings();
  const { add, remove } = useHoldingMutations();
  const rows = holdings.data ?? [];

  const quotes = useQuotesFor(rows.map((h) => ({ symbol: h.symbol, name: h.name })));
  const quoteMap = useMemo(() => {
    const map = new Map<string, NonNullable<typeof quotes.data>["quotes"][number]>();
    for (const q of quotes.data?.quotes ?? []) map.set(q.symbol, q);
    return map;
  }, [quotes.data]);

  const [form, setForm] = useState({ symbol: "", name: "", kind: "stock", quantity: "", avg_price: "" });

  const positions = useMemo(
    () =>
      rows.map((h) => {
        const q = quoteMap.get(h.symbol);
        const price = q && Number.isFinite(q.price) ? q.price : h.avg_price;
        const invested = h.quantity * h.avg_price;
        const value = h.quantity * price;
        const pnl = value - invested;
        return {
          ...h,
          price,
          invested,
          value,
          pnl,
          pnlPct: invested > 0 ? (pnl / invested) * 100 : 0,
          changePct: q?.changePct ?? 0,
          monthPct: q?.monthPct ?? 0,
          currency: q?.currency ?? "INR",
          sector: STOCK_UNIVERSE.find((s) => s.symbol === h.symbol)?.sector ?? "Other",
        };
      }),
    [rows, quoteMap],
  );

  const totals = positions.reduce(
    (acc, p) => {
      acc.invested += p.invested;
      acc.value += p.value;
      acc.day += (p.value * p.changePct) / 100;
      return acc;
    },
    { invested: 0, value: 0, day: 0 },
  );
  const totalPnl = totals.value - totals.invested;
  const currency = positions[0]?.currency ?? "INR";

  const bySector = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of positions) map.set(p.sector, (map.get(p.sector) ?? 0) + p.value);
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [positions]);

  const context = useMemo(
    () =>
      JSON.stringify({
        totals: { invested: totals.invested, value: totals.value, pnl: totalPnl },
        positions: positions.map((p) => ({
          symbol: p.symbol,
          name: p.name,
          kind: p.kind,
          sector: p.sector,
          qty: p.quantity,
          avgPrice: p.avg_price,
          price: Number(p.price.toFixed(2)),
          weightPct: totals.value > 0 ? Number(((p.value / totals.value) * 100).toFixed(1)) : 0,
          dayPct: Number(p.changePct.toFixed(2)),
          monthPct: Number(p.monthPct.toFixed(2)),
          pnlPct: Number(p.pnlPct.toFixed(2)),
        })),
      }),
    [positions, totals, totalPnl],
  );

  const adviseFn = useServerFn(advisePortfolio);
  const reviewFn = useServerFn(reviewPortfolio);

  const alerts = useMutation<PortfolioAlerts>({
    mutationFn: () => adviseFn({ data: { context } }),
    onError: (e: Error) => toast.error(e.message),
  });
  const review = useMutation<PortfolioReview>({
    mutationFn: () => reviewFn({ data: { context } }),
    onError: (e: Error) => toast.error(e.message),
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const quantity = Number(form.quantity);
    const avg = Number(form.avg_price);
    if (!form.symbol.trim() || !Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Enter a symbol and a positive quantity.");
      return;
    }
    const symbol = form.symbol.trim().toUpperCase();
    await add.mutateAsync({
      symbol,
      name: form.name.trim() || STOCK_UNIVERSE.find((s) => s.symbol === symbol)?.name || symbol,
      kind: form.kind,
      quantity,
      avg_price: Number.isFinite(avg) ? avg : 0,
    });
    setForm({ symbol: "", name: "", kind: "stock", quantity: "", avg_price: "" });
    toast.success("Holding added");
  }

  return (
    <AppShell
      title="Portfolio AI Advisor"
      description="Live valuation, allocation and AI monitoring of everything you own."
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => review.mutate()} disabled={!positions.length || review.isPending}>
            <Sparkle className="size-4" />
            {review.isPending ? "Reviewing…" : "AI review"}
          </Button>
          <Button onClick={() => alerts.mutate()} disabled={!positions.length || alerts.isPending}>
            <ShieldAlert className="size-4" />
            {alerts.isPending ? "Scanning…" : "Scan for alerts"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Current value" value={formatPrice(totals.value, currency)} tone="brand" />
        <StatCard label="Invested" value={formatPrice(totals.invested, currency)} />
        <StatCard
          label="Unrealised P&L"
          value={`${formatPrice(totalPnl, currency)} (${formatPct(totals.invested > 0 ? (totalPnl / totals.invested) * 100 : 0)})`}
          tone={totalPnl >= 0 ? "success" : "danger"}
        />
        <StatCard
          label="Today's move"
          value={formatPrice(totals.day, currency)}
          tone={totals.day >= 0 ? "success" : "danger"}
          hint="Change in portfolio value today"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <SectionCard
          title="Holdings"
          description="Live prices from Yahoo Finance, refreshed every minute."
          actions={<DataSource label="Yahoo Finance" />}
        >
          {positions.length === 0 ? (
            <EmptyState
              title="No holdings yet"
              description="Add your stocks or funds below and the AI advisor starts monitoring them for results, dividends, trend changes and big moves."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                    <th className="py-2">Holding</th>
                    <th className="py-2 text-right">Qty</th>
                    <th className="py-2 text-right">Avg</th>
                    <th className="py-2 text-right">Price</th>
                    <th className="py-2 text-right">Day</th>
                    <th className="py-2 text-right">Value</th>
                    <th className="py-2 text-right">P&L</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2">
                        <p className="font-medium">{p.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {p.symbol} · {p.sector}
                        </p>
                      </td>
                      <td className="num py-2 text-right">{p.quantity}</td>
                      <td className="num py-2 text-right">{formatPrice(p.avg_price, p.currency)}</td>
                      <td className="num py-2 text-right">{formatPrice(p.price, p.currency)}</td>
                      <td className={`num py-2 text-right ${toneFor(p.changePct)}`}>{formatPct(p.changePct)}</td>
                      <td className="num py-2 text-right">{formatPrice(p.value, p.currency)}</td>
                      <td className={`num py-2 text-right ${toneFor(p.pnl)}`}>
                        {formatPrice(p.pnl, p.currency)}
                        <span className="block text-[11px]">{formatPct(p.pnlPct)}</span>
                      </td>
                      <td className="py-2 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${p.symbol}`}
                          onClick={() => remove.mutate(p.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <form onSubmit={submit} className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <Label htmlFor="symbol">Symbol</Label>
              <Input
                id="symbol"
                placeholder="TCS.NS"
                value={form.symbol}
                onChange={(e) => setForm({ ...form, symbol: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="hname">Name (optional)</Label>
              <Input
                id="hname"
                placeholder="Tata Consultancy"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="qty">Quantity</Label>
              <Input
                id="qty"
                inputMode="decimal"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="avg">Avg price</Label>
              <Input
                id="avg"
                inputMode="decimal"
                value={form.avg_price}
                onChange={(e) => setForm({ ...form, avg_price: e.target.value })}
              />
            </div>
            <div className="sm:col-span-6">
              <Button type="submit" disabled={add.isPending}>
                <Plus className="size-4" />
                Add holding
              </Button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Allocation" description="Where your capital actually sits, by sector.">
          {bySector.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add holdings to see your allocation mix.</p>
          ) : (
            <>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={bySector} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={2}>
                      {bySector.map((_, i) => (
                        <Cell key={i} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatPrice(value, currency)}
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {bySector.map((s, i) => (
                  <li key={s.name} className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2 rounded-full"
                        style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }}
                      />
                      {s.name}
                    </span>
                    <span className="num text-muted-foreground">
                      {totals.value > 0 ? `${((s.value / totals.value) * 100).toFixed(1)}%` : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </SectionCard>
      </div>

      {alerts.data ? (
        <SectionCard title="AI monitoring alerts" description={alerts.data.summary}>
          <div className="space-y-3">
            {alerts.data.alerts.map((a, i) => (
              <div key={i} className="rounded-lg border border-border/60 bg-card/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone="brand">{a.symbol}</Pill>
                  <Pill tone={a.severity === "high" ? "negative" : a.severity === "medium" ? "neutral" : "positive"}>
                    {a.severity} · {a.type}
                  </Pill>
                </div>
                <p className="mt-2 text-sm">{a.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{a.action}</p>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <AiNotice />
          </div>
        </SectionCard>
      ) : null}

      {review.data ? (
        <SectionCard title="AI portfolio review" description={review.data.summary}>
          <div className="grid gap-5 lg:grid-cols-2">
            <Bullets title="Strengths" items={review.data.strengths} />
            <Bullets title="Concentration risks" items={review.data.concentrationRisks} />
            <Bullets title="Diversification ideas" items={review.data.diversificationIdeas} />
            <Bullets title="Characteristics" items={review.data.characteristics} />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{review.data.healthNote}</p>
          <div className="mt-4">
            <AiNotice>{review.data.disclaimer}</AiNotice>
          </div>
        </SectionCard>
      ) : null}
    </AppShell>
  );
}