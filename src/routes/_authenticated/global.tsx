import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Globe2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/layout/AppShell";
import { SectionCard, StatCard } from "@/components/wealth/StatCard";
import { AiNotice, DataSource, QuoteTile, SkeletonGrid } from "@/components/market/MarketWidgets";
import { Button } from "@/components/ui/button";
import { useMarketOverview } from "@/hooks/useMarketData";
import { analyseGlobalImpact, type GlobalImpact } from "@/lib/ai.functions";
import { formatPct, toneFor, type Quote } from "@/lib/market";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/global")({
  head: () => ({
    meta: [
      { title: "Global Markets — AI Wealth OS" },
      {
        name: "description",
        content:
          "Track NASDAQ, S&P 500, Dow, FTSE, Nikkei, Hang Seng, commodities, the dollar and crypto — and how each may transmit to Indian markets.",
      },
      { property: "og:title", content: "Global Markets — AI Wealth OS" },
      { property: "og:description", content: "Global market dashboard with AI transmission analysis for India." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GlobalPage,
});

function GlobalPage() {
  const overview = useMarketOverview();
  const groups = useMemo(() => overview.data?.groups ?? [], [overview.data]);
  const all: Quote[] = groups.flatMap((g) => g.quotes);
  const india = groups.find((g) => g.key === "india")?.quotes ?? [];
  const globalQuotes = useMemo(
    () => groups.find((g) => g.key === "global")?.quotes ?? [],
    [groups],
  );

  const breadth = useMemo(() => {
    const up = globalQuotes.filter((q) => q.changePct > 0).length;
    return { up, down: globalQuotes.length - up };
  }, [globalQuotes]);

  const aiFn = useServerFn(analyseGlobalImpact);
  const ai = useMutation<GlobalImpact>({
    mutationFn: () =>
      aiFn({
        data: {
          context: JSON.stringify(
            all.map((q) => ({
              market: q.name,
              dayPct: Number(q.changePct.toFixed(2)),
              weekPct: Number(q.weekPct.toFixed(2)),
              monthPct: Number(q.monthPct.toFixed(2)),
            })),
          ),
        },
      }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      title="Global Markets"
      description="Overnight cues, commodities and currencies — read through an Indian lens."
      actions={
        <Button onClick={() => ai.mutate()} disabled={!all.length || ai.isPending}>
          <Globe2 className="size-4" />
          {ai.isPending ? "Analysing…" : "AI impact on India"}
        </Button>
      }
    >
      {overview.isLoading ? (
        <SkeletonGrid count={8} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Global breadth"
              value={`${breadth.up} up / ${breadth.down} down`}
              tone={breadth.up >= breadth.down ? "success" : "danger"}
              hint="Major global indices today"
            />
            <StatCard
              label="NIFTY 50"
              value={formatPct(india.find((q) => q.symbol === "^NSEI")?.changePct ?? 0)}
              tone={(india.find((q) => q.symbol === "^NSEI")?.changePct ?? 0) >= 0 ? "success" : "danger"}
            />
            <StatCard
              label="Crude (WTI)"
              value={formatPct(all.find((q) => q.symbol === "CL=F")?.changePct ?? 0)}
              hint="Higher crude pressures the rupee and margins"
            />
            <StatCard
              label="USD / INR"
              value={formatPct(all.find((q) => q.symbol === "INR=X")?.changePct ?? 0)}
              hint="A rising quote means a weaker rupee"
            />
          </div>

          {groups.map((group) => (
            <SectionCard
              key={group.key}
              title={group.label}
              description="Live prices with weekly and monthly context."
              actions={<DataSource label="Yahoo Finance" />}
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {group.quotes.map((q) => (
                  <QuoteTile key={q.symbol} quote={q} />
                ))}
              </div>
            </SectionCard>
          ))}

          <SectionCard title="Relative performance" description="One-month move across every tracked market.">
            <div className="space-y-2">
              {[...all]
                .sort((a, b) => b.monthPct - a.monthPct)
                .map((q) => {
                  const width = Math.min(100, Math.abs(q.monthPct) * 4);
                  return (
                    <div key={q.symbol} className="grid grid-cols-[minmax(0,140px)_1fr_64px] items-center gap-3">
                      <span className="truncate text-xs">{q.name}</span>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full", q.monthPct >= 0 ? "bg-emerald-500" : "bg-rose-500")}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <span className={cn("num text-right text-xs", toneFor(q.monthPct))}>{formatPct(q.monthPct)}</span>
                    </div>
                  );
                })}
            </div>
          </SectionCard>

          {ai.data ? (
            <SectionCard title="How this may reach India" description={ai.data.summary}>
              <div className="grid gap-3 sm:grid-cols-2">
                {ai.data.impacts.map((impact, i) => (
                  <div key={i} className="rounded-lg border border-border/60 bg-card/40 p-3">
                    <p className="text-sm font-semibold">{impact.market}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{impact.move}</p>
                    <p className="mt-2 text-sm">{impact.indiaImpact}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <AiNotice>{ai.data.disclaimer}</AiNotice>
              </div>
            </SectionCard>
          ) : null}
        </>
      )}
    </AppShell>
  );
}