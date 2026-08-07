import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Layers } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/layout/AppShell";
import { SectionCard, StatCard } from "@/components/wealth/StatCard";
import {
  AiNotice,
  DataSource,
  Pill,
  ScoreBar,
  SkeletonGrid,
  Sparkline,
} from "@/components/market/MarketWidgets";
import { Button } from "@/components/ui/button";
import { useFinancialNews, useStockBoard } from "@/hooks/useMarketData";
import { analyseSectors, type SectorTake } from "@/lib/ai.functions";
import { SECTORS, formatPct, formatPrice, toneFor, type ScoredStock } from "@/lib/market";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/sectors")({
  head: () => ({
    meta: [
      { title: "Sector Intelligence — AI Wealth OS" },
      {
        name: "description",
        content:
          "Live sector performance, heatmap, leaders and laggards across IT, Banking, Auto, Pharma, Energy, Defence and more, with AI commentary.",
      },
      { property: "og:title", content: "Sector Intelligence — AI Wealth OS" },
      {
        property: "og:description",
        content: "Sector heatmap, rotation and AI analysis of Indian equities.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SectorsPage,
});

function avg(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function heatTone(pct: number) {
  if (pct >= 2) return "bg-emerald-500/30";
  if (pct >= 0.5) return "bg-emerald-500/20";
  if (pct > -0.5) return "bg-muted";
  if (pct > -2) return "bg-rose-500/20";
  return "bg-rose-500/30";
}

function SectorsPage() {
  const board = useStockBoard();
  const [active, setActive] = useState<string>(SECTORS[0]);
  const news = useFinancialNews(`${active} sector India`);

  const sectors = useMemo(() => {
    const stocks = board.data?.stocks ?? [];
    return SECTORS.map((sector) => {
      const members = stocks.filter((s) => s.sector === sector);
      return {
        sector,
        members,
        dayPct: avg(members.map((m) => m.changePct)),
        weekPct: avg(members.map((m) => m.weekPct)),
        monthPct: avg(members.map((m) => m.monthPct)),
        opportunity: Math.round(avg(members.map((m) => m.opportunity))),
        momentum: Math.round(avg(members.map((m) => m.momentum))),
        risk: Math.round(avg(members.map((m) => m.risk))),
      };
    }).sort((a, b) => b.dayPct - a.dayPct);
  }, [board.data]);

  const activeSector = sectors.find((s) => s.sector === active);
  const leaders = [...(activeSector?.members ?? [])].sort((a, b) => b.changePct - a.changePct);

  const aiFn = useServerFn(analyseSectors);
  const ai = useMutation<SectorTake>({
    mutationFn: () =>
      aiFn({
        data: {
          context: JSON.stringify(
            sectors.map((s) => ({
              sector: s.sector,
              dayPct: Number(s.dayPct.toFixed(2)),
              weekPct: Number(s.weekPct.toFixed(2)),
              monthPct: Number(s.monthPct.toFixed(2)),
              momentum: s.momentum,
              risk: s.risk,
              leaders: s.members
                .slice()
                .sort((a, b) => b.monthPct - a.monthPct)
                .slice(0, 3)
                .map((m) => m.name),
            })),
          ),
        },
      }),
    onError: (e: Error) => toast.error(e.message),
  });

  const takes = new Map((ai.data?.sectors ?? []).map((s) => [s.sector.toLowerCase(), s.view]));

  return (
    <AppShell
      title="Sector Intelligence"
      description="Where money is rotating across the Indian market, sector by sector."
      actions={
        <Button onClick={() => ai.mutate()} disabled={!sectors.length || ai.isPending}>
          <Layers className="size-4" />
          {ai.isPending ? "Analysing…" : "AI sector analysis"}
        </Button>
      }
    >
      {board.isLoading ? (
        <SkeletonGrid count={8} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Best sector today"
              value={sectors[0]?.sector ?? "—"}
              tone="success"
              hint={formatPct(sectors[0]?.dayPct ?? 0)}
            />
            <StatCard
              label="Weakest sector today"
              value={sectors[sectors.length - 1]?.sector ?? "—"}
              tone="danger"
              hint={formatPct(sectors[sectors.length - 1]?.dayPct ?? 0)}
            />
            <StatCard
              label="Strongest month"
              value={[...sectors].sort((a, b) => b.monthPct - a.monthPct)[0]?.sector ?? "—"}
              tone="brand"
            />
            <StatCard
              label="Sectors tracked"
              value={String(sectors.length)}
              hint="Live NSE constituents"
            />
          </div>

          <SectionCard
            title="Sector heatmap"
            description="Average move of the tracked constituents in each sector."
            actions={<DataSource label="Yahoo Finance" />}
          >
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {sectors.map((s) => (
                <button
                  key={s.sector}
                  onClick={() => setActive(s.sector)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-all hover:scale-[1.02]",
                    heatTone(s.dayPct),
                    active === s.sector ? "border-primary" : "border-transparent",
                  )}
                >
                  <p className="text-sm font-medium">{s.sector}</p>
                  <p className={cn("num text-lg font-semibold", toneFor(s.dayPct))}>
                    {formatPct(s.dayPct)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    1W {formatPct(s.weekPct)} · 1M {formatPct(s.monthPct)}
                  </p>
                </button>
              ))}
            </div>
          </SectionCard>

          <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
            <SectionCard
              title={`${active} — companies`}
              description="Live constituents sorted by today's move."
            >
              <div className="space-y-3">
                {leaders.map((s: ScoredStock) => (
                  <div
                    key={s.symbol}
                    className="grid items-center gap-3 rounded-lg border border-border/60 p-3 sm:grid-cols-[1.4fr_1fr_1fr]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.name}</p>
                      <p className="text-[11px] text-muted-foreground">{s.symbol}</p>
                    </div>
                    <div>
                      <p className="num text-sm font-semibold">
                        {formatPrice(s.price, s.currency)}
                      </p>
                      <p className={cn("num text-xs", toneFor(s.changePct))}>
                        {formatPct(s.changePct)} today · {formatPct(s.monthPct)} 1M
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24">
                        <Sparkline values={s.spark} positive={s.monthPct >= 0} />
                      </div>
                      <div className="flex-1">
                        <ScoreBar label="Opportunity" value={s.opportunity} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <div className="space-y-5">
              <SectionCard
                title={`${active} — sector profile`}
                description="Blended scores across the sector."
              >
                <div className="space-y-3">
                  <ScoreBar label="Momentum" value={activeSector?.momentum ?? 0} />
                  <ScoreBar label="Opportunity" value={activeSector?.opportunity ?? 0} />
                  <ScoreBar label="Risk" value={activeSector?.risk ?? 0} />
                </div>
                {takes.get(active.toLowerCase()) ? (
                  <p className="mt-4 rounded-lg bg-primary/5 p-3 text-sm">
                    {takes.get(active.toLowerCase())}
                  </p>
                ) : null}
              </SectionCard>

              <SectionCard
                title={`${active} — headlines`}
                description="Latest sector news from major financial publishers."
              >
                <div className="space-y-3">
                  {(news.data?.items ?? []).slice(0, 6).map((item) => (
                    <a
                      key={item.id}
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-lg border border-border/60 p-3 transition-colors hover:bg-muted/50"
                    >
                      <p className="text-sm leading-snug">{item.title}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{item.source}</p>
                    </a>
                  ))}
                  {news.isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading headlines…</p>
                  ) : null}
                </div>
              </SectionCard>
            </div>
          </div>

          {ai.data ? (
            <SectionCard title="AI sector read" description="Two-line view on every sector.">
              <div className="grid gap-3 sm:grid-cols-2">
                {ai.data.sectors.map((s) => (
                  <div key={s.sector} className="rounded-lg border border-border/60 bg-card/40 p-3">
                    <Pill tone="brand">{s.sector}</Pill>
                    <p className="mt-2 text-sm text-muted-foreground">{s.view}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <AiNotice />
              </div>
            </SectionCard>
          ) : null}
        </>
      )}
    </AppShell>
  );
}
