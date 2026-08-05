import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/layout/AppShell";
import { SectionCard, StatCard } from "@/components/wealth/StatCard";
import { AiNotice, Pill } from "@/components/market/MarketWidgets";
import { Button } from "@/components/ui/button";
import { generateEconomicCalendar, type EconomicCalendar } from "@/lib/ai.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Economic Calendar — AI Wealth OS" },
      {
        name: "description",
        content:
          "Upcoming RBI and Fed meetings, GDP and inflation releases, employment data, earnings, dividends and IPOs for the next six weeks.",
      },
      { property: "og:title", content: "Economic Calendar — AI Wealth OS" },
      { property: "og:description", content: "Six weeks of market-moving events for Indian and US markets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CalendarPage,
});

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function CalendarPage() {
  const today = new Date().toISOString().slice(0, 10);
  const fn = useServerFn(generateEconomicCalendar);

  const calendar = useQuery<EconomicCalendar>({
    queryKey: ["economic-calendar", today],
    queryFn: () => fn({ data: { today } }),
    staleTime: 6 * 60 * 60 * 1000,
    retry: 0,
  });

  if (calendar.error) toast.error((calendar.error as Error).message);

  const upcoming = useMemo(() => {
    const events = (calendar.data?.groups ?? []).flatMap((g) =>
      g.events.map((e) => ({ ...e, group: g.group })),
    );
    return events.sort((a, b) => a.date.localeCompare(b.date));
  }, [calendar.data]);

  const highImpact = upcoming.filter((e) => e.impact === "high");

  return (
    <AppShell
      title="Economic Calendar"
      description="What's scheduled next across policy, data and corporate events."
      actions={
        <Button onClick={() => calendar.refetch()} disabled={calendar.isFetching}>
          <CalendarDays className="size-4" />
          {calendar.isFetching ? "Building…" : "Refresh calendar"}
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Events ahead" value={String(upcoming.length)} tone="brand" hint="Next ~6 weeks" />
        <StatCard label="High impact" value={String(highImpact.length)} tone="warning" />
        <StatCard
          label="Next event"
          value={upcoming[0] ? formatDate(upcoming[0].date) : "—"}
          hint={upcoming[0]?.title ?? "Awaiting schedule"}
        />
        <StatCard label="Groups tracked" value={String(calendar.data?.groups.length ?? 0)} />
      </div>

      {calendar.isLoading ? (
        <div className="surface h-48 animate-pulse bg-muted/40" />
      ) : (
        <>
          <SectionCard title="Timeline" description="Everything scheduled, in date order.">
            <ol className="relative space-y-4 border-l border-border pl-5">
              {upcoming.map((e, i) => (
                <li key={i} className="relative">
                  <span
                    className={cn(
                      "absolute top-1.5 -left-[25px] size-2.5 rounded-full",
                      e.impact === "high" ? "bg-rose-500" : e.impact === "medium" ? "bg-amber-500" : "bg-primary",
                    )}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="num text-xs text-muted-foreground">{formatDate(e.date)}</span>
                    <Pill tone="brand">{e.group}</Pill>
                    <Pill tone={e.impact === "high" ? "negative" : e.impact === "medium" ? "neutral" : "positive"}>
                      {e.impact} impact
                    </Pill>
                  </div>
                  <p className="mt-1 text-sm font-medium">{e.title}</p>
                  <p className="text-sm text-muted-foreground">{e.detail}</p>
                </li>
              ))}
            </ol>
          </SectionCard>

          <div className="grid gap-5 lg:grid-cols-2">
            {(calendar.data?.groups ?? []).map((g) => (
              <SectionCard key={g.group} title={g.group} description={`${g.events.length} scheduled`}>
                <div className="space-y-2">
                  {g.events.map((e, i) => (
                    <div key={i} className="rounded-lg border border-border/60 bg-card/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{e.title}</p>
                        <span className="num text-[11px] text-muted-foreground">{formatDate(e.date)}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{e.detail}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>
            ))}
          </div>

          <AiNotice>
            {calendar.data?.disclaimer ??
              "AI-compiled schedule. Dates can move — always confirm against the official RBI, Fed, exchange or company announcement."}
          </AiNotice>
        </>
      )}
    </AppShell>
  );
}