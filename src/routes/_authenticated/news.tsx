import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SectionCard } from "@/components/wealth/StatCard";
import { AiNotice, DataSource, Pill } from "@/components/market/MarketWidgets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFinancialNews } from "@/hooks/useMarketData";
import { analyseHeadlines, type NewsAnalysis } from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/news")({
  head: () => ({
    meta: [
      { title: "News Intelligence — AI Wealth OS" },
      {
        name: "description",
        content:
          "Financial headlines from Moneycontrol, ET, Mint, Reuters, Bloomberg and more, with AI summaries, sentiment and importance scores.",
      },
      { property: "og:title", content: "News Intelligence — AI Wealth OS" },
      { property: "og:description", content: "AI-scored financial news in one feed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewsPage,
});

function NewsPage() {
  const [topic, setTopic] = useState("");
  const [applied, setApplied] = useState("");
  const news = useFinancialNews(applied);
  const analyseFn = useServerFn(analyseHeadlines);

  const analysis = useMutation<NewsAnalysis, Error, void>({
    mutationFn: async () =>
      analyseFn({
        data: {
          headlines: (news.data?.items ?? [])
            .slice(0, 20)
            .map((n) => ({ id: n.id, title: n.title, source: n.source })),
        },
      }),
  });

  const insightFor = (id: string) => analysis.data?.items.find((i) => i.id === id);

  return (
    <AppShell
      title="News Intelligence Center"
      description="Continuously refreshed financial news with AI summaries, sentiment and impact."
      actions={
        <Button
          size="sm"
          onClick={() => analysis.mutate()}
          disabled={analysis.isPending || !news.data?.items.length}
        >
          <Sparkles className="mr-2 size-4" />
          {analysis.isPending ? "Analysing…" : "Analyse feed"}
        </Button>
      }
    >
      <SectionCard
        title="Filter the feed"
        description="Search a company, sector or theme. Leave blank for the broad market feed."
        actions={<DataSource label="Publisher RSS via Google News" />}
      >
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(topic.trim());
          }}
        >
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Reliance, banking, inflation"
            maxLength={60}
            className="max-w-sm"
          />
          <Button type="submit" variant="outline">
            Apply
          </Button>
        </form>
      </SectionCard>

      <SectionCard
        title={applied ? `Headlines · ${applied}` : "Top financial headlines"}
        description="Live headlines; AI fields appear after you run the analysis."
      >
        {analysis.error ? (
          <p className="mb-3 text-sm text-destructive">{analysis.error.message}</p>
        ) : null}
        <div className="space-y-3">
          {news.isLoading ? <p className="text-sm text-muted-foreground">Loading headlines…</p> : null}
          {(news.data?.items ?? []).map((item) => {
            const insight = insightFor(item.id);
            return (
              <article key={item.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone="brand">{item.source}</Pill>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(item.publishedAt).toLocaleString()}
                  </span>
                  {insight ? (
                    <>
                      <Pill
                        tone={
                          insight.sentiment === "positive"
                            ? "positive"
                            : insight.sentiment === "negative"
                              ? "negative"
                              : "neutral"
                        }
                      >
                        {insight.sentiment}
                      </Pill>
                      <Pill>{insight.category}</Pill>
                      <Pill>Importance {insight.importance}/10</Pill>
                    </>
                  ) : null}
                </div>
                <a
                  href={item.link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block font-medium hover:underline"
                >
                  {item.title}
                </a>
                {insight ? (
                  <div className="mt-2 space-y-2">
                    <p className="text-sm text-muted-foreground">{insight.summary}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {insight.companies.map((c) => (
                        <Pill key={c}>{c}</Pill>
                      ))}
                      {insight.sectors.map((s) => (
                        <Pill key={s} tone="brand">
                          {s}
                        </Pill>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
        <div className="mt-4">
          <AiNotice />
        </div>
      </SectionCard>
    </AppShell>
  );
}