import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState, SectionCard, StatCard } from "@/components/wealth/StatCard";
import { DataSource, Pill, ScoreBar, Sparkline } from "@/components/market/MarketWidgets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useQuotesFor,
  useWatchlistItems,
  useWatchlistMutations,
  useWatchlists,
} from "@/hooks/useMarketData";
import { STOCK_UNIVERSE, formatPct, formatPrice, scoreStock, toneFor } from "@/lib/market";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/watchlist")({
  head: () => ({
    meta: [
      { title: "Watchlists — AI Wealth OS" },
      {
        name: "description",
        content:
          "Unlimited watchlists with live prices, target price and stop-loss tracking, AI opportunity scores and technical trend.",
      },
      { property: "og:title", content: "Watchlists — AI Wealth OS" },
      { property: "og:description", content: "Track any stock with targets, stops and AI scores." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WatchlistPage,
});

function WatchlistPage() {
  const lists = useWatchlists();
  const items = useWatchlistItems();
  const { createList, removeList, addItem, removeItem } = useWatchlistMutations();

  const [activeId, setActiveId] = useState<string>("");
  const [listName, setListName] = useState("");
  const [form, setForm] = useState({ symbol: "", name: "", target: "", stop: "" });

  useEffect(() => {
    const all = lists.data ?? [];
    if (all.length && !all.some((l) => l.id === activeId)) setActiveId(all[0]!.id);
  }, [lists.data, activeId]);

  const rows = useMemo(
    () => (items.data ?? []).filter((i) => i.watchlist_id === activeId),
    [items.data, activeId],
  );

  const quotes = useQuotesFor(rows.map((r) => ({ symbol: r.symbol, name: r.name })));

  const enriched = useMemo(() => {
    const list = quotes.data?.quotes ?? [];
    return rows.map((item) => {
      const q = list.find((x) => x.symbol === item.symbol);
      const meta = STOCK_UNIVERSE.find((s) => s.symbol === item.symbol);
      const scored =
        q && Number.isFinite(q.price)
          ? scoreStock({ symbol: item.symbol, name: item.name, sector: meta?.sector ?? "IT" }, q)
          : null;
      return { item, scored };
    });
  }, [rows, quotes.data]);

  const hits = enriched.filter(
    (e) => e.scored && e.item.target_price && e.scored.price >= Number(e.item.target_price),
  ).length;
  const stops = enriched.filter(
    (e) => e.scored && e.item.stop_loss && e.scored.price <= Number(e.item.stop_loss),
  ).length;

  async function submitItem(event: React.FormEvent) {
    event.preventDefault();
    if (!activeId) {
      toast.error("Create a watchlist first.");
      return;
    }
    const symbol = form.symbol.trim().toUpperCase();
    if (!symbol) {
      toast.error("Enter a symbol, e.g. TCS.NS");
      return;
    }
    await addItem.mutateAsync({
      watchlist_id: activeId,
      symbol,
      name: form.name.trim() || STOCK_UNIVERSE.find((s) => s.symbol === symbol)?.name || symbol,
      target_price: form.target ? Number(form.target) : null,
      stop_loss: form.stop ? Number(form.stop) : null,
    });
    setForm({ symbol: "", name: "", target: "", stop: "" });
    toast.success("Added to watchlist");
  }

  return (
    <AppShell
      title="Watchlists"
      description="Unlimited lists with live prices, targets, stops and AI scores."
      actions={
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!listName.trim()) return;
            await createList.mutateAsync(listName.trim());
            setListName("");
            toast.success("Watchlist created");
          }}
        >
          <Input
            className="w-40"
            placeholder="New watchlist"
            value={listName}
            onChange={(e) => setListName(e.target.value)}
          />
          <Button type="submit" disabled={createList.isPending}>
            <Plus className="size-4" />
            Create
          </Button>
        </form>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Watchlists" value={String(lists.data?.length ?? 0)} tone="brand" />
        <StatCard label="Tracked symbols" value={String(items.data?.length ?? 0)} />
        <StatCard
          label="Targets hit"
          value={String(hits)}
          tone="success"
          hint="Price at or above your target"
        />
        <StatCard
          label="Stops breached"
          value={String(stops)}
          tone="danger"
          hint="Price at or below your stop"
        />
      </div>

      {(lists.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No watchlists yet"
          description="Create your first list above — you can keep as many as you like, one per theme, sector or strategy."
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {(lists.data ?? []).map((l) => (
              <div
                key={l.id}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-1 py-0.5 text-xs transition-colors",
                  activeId === l.id ? "border-primary bg-primary/10 text-primary" : "border-border",
                )}
              >
                <button className="px-2 py-1 font-medium" onClick={() => setActiveId(l.id)}>
                  {l.name}
                </button>
                <button
                  aria-label={`Delete ${l.name}`}
                  className="rounded-full p-1 text-muted-foreground hover:text-destructive"
                  onClick={() => removeList.mutate(l.id)}
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
          </div>

          <SectionCard
            title="Tracked symbols"
            description="Live prices with your target and stop levels."
            actions={<DataSource label="Yahoo Finance" />}
          >
            {enriched.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing in this list yet — add a symbol below.
              </p>
            ) : (
              <div className="space-y-3">
                {enriched.map(({ item, scored }) => (
                  <div
                    key={item.id}
                    className="grid items-center gap-3 rounded-lg border border-border/60 p-3 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="text-[11px] text-muted-foreground">{item.symbol}</p>
                    </div>
                    <div>
                      <p className="num text-sm font-semibold">
                        {scored ? formatPrice(scored.price, scored.currency) : "—"}
                      </p>
                      <p className={cn("num text-xs", toneFor(scored?.changePct ?? 0))}>
                        {scored ? formatPct(scored.changePct) : "Loading…"}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <p>
                        Target:{" "}
                        <span className="num text-foreground">
                          {item.target_price ? item.target_price : "—"}
                        </span>
                      </p>
                      <p>
                        Stop:{" "}
                        <span className="num text-foreground">
                          {item.stop_loss ? item.stop_loss : "—"}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-20">
                        {scored ? (
                          <Sparkline values={scored.spark} positive={scored.monthPct >= 0} />
                        ) : null}
                      </div>
                      <div className="flex-1 space-y-1">
                        <ScoreBar label="AI score" value={scored?.opportunity ?? 0} />
                        {scored ? (
                          <Pill
                            tone={
                              scored.trend === "Uptrend"
                                ? "positive"
                                : scored.trend === "Downtrend"
                                  ? "negative"
                                  : "neutral"
                            }
                          >
                            {scored.trend}
                          </Pill>
                        ) : null}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${item.symbol}`}
                      onClick={() => removeItem.mutate(item.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <form
              onSubmit={submitItem}
              className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-5"
            >
              <div className="sm:col-span-2">
                <Label htmlFor="wsym">Symbol</Label>
                <Input
                  id="wsym"
                  placeholder="RELIANCE.NS"
                  value={form.symbol}
                  onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="wtarget">Target price</Label>
                <Input
                  id="wtarget"
                  inputMode="decimal"
                  value={form.target}
                  onChange={(e) => setForm({ ...form, target: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="wstop">Stop loss</Label>
                <Input
                  id="wstop"
                  inputMode="decimal"
                  value={form.stop}
                  onChange={(e) => setForm({ ...form, stop: e.target.value })}
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={addItem.isPending} className="w-full">
                  <Star className="size-4" />
                  Add
                </Button>
              </div>
            </form>
          </SectionCard>
        </>
      )}
    </AppShell>
  );
}
