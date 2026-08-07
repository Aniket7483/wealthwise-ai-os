import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SectionCard } from "@/components/wealth/StatCard";
import {
  AiNotice,
  Bullets,
  DataSource,
  Pill,
  QuoteTile,
  SkeletonGrid,
} from "@/components/market/MarketWidgets";
import { Button } from "@/components/ui/button";
import { useFinancialNews, useMarketOverview } from "@/hooks/useMarketData";
import { generateMarketBrief, type MarketBrief } from "@/lib/ai.functions";
import { formatPct } from "@/lib/market";

export const Route = createFileRoute("/_authenticated/market")({
  head: () => ({
    meta: [
      { title: "Market Intelligence — AI Wealth OS" },
      {
        name: "description",
        content:
          "Live indices, commodities, currencies and crypto with an AI-written daily market brief for Indian investors.",
      },
      { property: "og:title", content: "Market Intelligence — AI Wealth OS" },
      {
        property: "og:description",
        content: "Your live markets cockpit with AI commentary.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MarketPage,
});

function MarketPage() {
  const overview = useMarketOverview();
  const news = useFinancialNews();
  const briefFn = useServerFn(generateMarketBrief);

  const brief = useMutation<MarketBrief, Error, void>({
    mutationFn: async () => {
      const context = [
        "LIVE QUOTES:",
        ...(overview.data?.groups ?? []).flatMap((g) =>
          g.quotes.map(
            (q) =>
              `${q.name} (${q.symbol}): ${q.price?.toFixed(2)} ${q.currency}, day ${formatPct(q.changePct)}, week ${formatPct(q.weekPct)}, month ${formatPct(q.monthPct)}`,
          ),
        ),
        "",
        "RECENT HEADLINES:",
        ...(news.data?.items ?? []).slice(0, 20).map((n) => `- ${n.title} (${n.source})`),
      ].join("\n");
      return briefFn({ data: { context } });
    },
  });

  return (
    <AppShell
      title="Market Intelligence"
      description="Live global markets, commodities, currencies and an AI morning brief."
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => overview.refetch()}
          disabled={overview.isFetching}
        >
          <RefreshCw className="mr-2 size-4" /> Refresh
        </Button>
      }
    >
      {overview.isLoading ? <SkeletonGrid /> : null}

      {(overview.data?.groups ?? []).map((group) => (
        <SectionCard
          key={group.key}
          title={group.label}
          description="Price, daily / weekly change and 60-day trend."
          actions={<DataSource label="Yahoo Finance (live)" />}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {group.quotes.map((quote) => (
              <QuoteTile key={quote.symbol} quote={quote} />
            ))}
          </div>
        </SectionCard>
      ))}

      <SectionCard
        title="AI market summary"
        description="Generated from the live snapshot above plus the latest financial headlines."
        actions={
          <Button
            size="sm"
            onClick={() => brief.mutate()}
            disabled={brief.isPending || overview.isLoading}
          >
            <Sparkles className="mr-2 size-4" />
            {brief.isPending ? "Generating…" : "Generate today's brief"}
          </Button>
        }
      >
        {brief.error ? <p className="text-sm text-destructive">{brief.error.message}</p> : null}
        {brief.data ? (
          <div className="space-y-5">
            <div>
              <h3 className="font-display text-lg font-semibold">{brief.data.headline}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{brief.data.summary}</p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <Bullets title="Key events" items={brief.data.keyEvents} />
              <Bullets title="Trending sectors" items={brief.data.trendingSectors} />
              <Bullets title="Corporate results" items={brief.data.corporateResults} />
              <Bullets title="Economic events" items={brief.data.economicEvents} />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wide uppercase">Stocks to watch</p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {brief.data.stocksToWatch.map((s) => (
                  <div key={s.name} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{s.why}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[
                ["RBI update", brief.data.rbiUpdate],
                ["Federal Reserve", brief.data.fedUpdate],
                ["Oil impact", brief.data.oilImpact],
                ["Gold movement", brief.data.goldMovement],
                ["Dollar movement", brief.data.dollarMovement],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-muted/40 p-3">
                  <p className="text-[11px] font-semibold tracking-wide uppercase">{label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{value}</p>
                </div>
              ))}
            </div>
            <AiNotice>{brief.data.disclaimer}</AiNotice>
          </div>
        ) : (
          <AiNotice />
        )}
      </SectionCard>

      <SectionCard
        title="Latest headlines"
        description="Moneycontrol, ET, Mint, Reuters, Bloomberg, CNBC, Yahoo Finance and MarketWatch."
        actions={
          <Link to="/news" className="text-sm text-primary hover:underline">
            Open news centre
          </Link>
        }
      >
        <ul className="space-y-3">
          {(news.data?.items ?? []).slice(0, 8).map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-2">
              <Pill tone="brand">{item.source}</Pill>
              <a
                href={item.link}
                target="_blank"
                rel="noreferrer"
                className="text-sm hover:underline"
              >
                {item.title}
              </a>
            </li>
          ))}
          {news.isLoading ? (
            <li className="text-sm text-muted-foreground">Loading headlines…</li>
          ) : null}
        </ul>
      </SectionCard>
    </AppShell>
  );
}
