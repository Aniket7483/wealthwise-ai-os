import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send, MessagesSquare } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/layout/AppShell";
import { SectionCard } from "@/components/wealth/StatCard";
import { AiNotice } from "@/components/market/MarketWidgets";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useHoldings, useMarketOverview } from "@/hooks/useMarketData";
import { useExpenses, useGoals, useIncomeSources, useProfile } from "@/hooks/useWealthData";
import { askAssistant } from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({
    meta: [
      { title: "AI Assistant — AI Wealth OS" },
      {
        name: "description",
        content:
          "Ask your personal CFO anything about markets, your portfolio, spending and goals — answered with your live app data.",
      },
      { property: "og:title", content: "AI Assistant — AI Wealth OS" },
      { property: "og:description", content: "Chat with an AI that can see your live market and finance data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssistantPage,
});

type Msg = { role: "user" | "assistant"; text: string; bullets?: string[]; followUps?: string[] };

const SUGGESTIONS = [
  "How is my portfolio positioned right now?",
  "What moved the Indian market today?",
  "Where am I overspending this month?",
  "Am I on track for my goals?",
];

function AssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const profile = useProfile();
  const holdings = useHoldings();
  const expenses = useExpenses();
  const goals = useGoals();
  const income = useIncomeSources();
  const overview = useMarketOverview();

  const ask = useServerFn(askAssistant);

  useEffect(() => {
    boxRef.current?.focus();
  }, [busy]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    const history = [...messages, { role: "user" as const, text }];
    setMessages(history);
    setInput("");
    setBusy(true);
    try {
      const context = JSON.stringify({
        currency: profile.data?.currency ?? "INR",
        riskProfile: profile.data?.risk_profile,
        monthlyIncome: (income.data ?? []).reduce((a, s) => a + Number(s.monthly_amount), 0),
        holdings: (holdings.data ?? []).map((h) => ({
          symbol: h.symbol,
          qty: h.quantity,
          avg: h.avg_price,
        })),
        goals: (goals.data ?? []).map((g) => ({
          name: g.name,
          target: g.target_amount,
          current: g.current_amount,
          date: g.target_date,
        })),
        recentExpenses: (expenses.data ?? []).slice(0, 60).map((e) => ({
          date: e.spent_on,
          category: e.category,
          amount: e.amount,
        })),
        markets: (overview.data?.groups ?? []).flatMap((g) =>
          g.quotes.map((q) => ({ name: q.name, dayPct: Number(q.changePct.toFixed(2)) })),
        ),
      });
      const conversation = history
        .slice(-8)
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`)
        .join("\n");
      const reply = await ask({ data: { question: conversation, context } });
      setMessages([
        ...history,
        { role: "assistant", text: reply.answer, bullets: reply.bullets, followUps: reply.followUps },
      ]);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="AI Assistant" description="Your personal CFO — it can see your live market and finance data.">
      <SectionCard title="Conversation" description="This session only; nothing is stored yet.">
        <div className="max-h-[52vh] space-y-4 overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <MessagesSquare className="mx-auto size-6 text-primary" />
              <p className="mt-2 text-sm font-medium">Ask anything about your money or the market</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void send(s)}
                    className="rounded-full border border-border px-3 py-1 text-xs transition-colors hover:bg-muted"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-[80%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground">
                  {m.text}
                </p>
              </div>
            ) : (
              <div key={i} className="space-y-2">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</p>
                {m.bullets?.length ? (
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {m.bullets.map((b, j) => (
                      <li key={j} className="flex gap-2">
                        <span className="text-primary">•</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {m.followUps?.length ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {m.followUps.map((f) => (
                      <button
                        key={f}
                        onClick={() => void send(f)}
                        className="rounded-full border border-border px-3 py-1 text-xs transition-colors hover:bg-muted"
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ),
          )}
          {busy ? <p className="animate-pulse text-sm text-muted-foreground">Thinking…</p> : null}
          <div ref={endRef} />
        </div>

        <form
          className="mt-4 flex items-end gap-2 border-t border-border pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <Textarea
            ref={boxRef}
            rows={2}
            value={input}
            placeholder="Ask about a stock, your portfolio, spending or goals…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
          />
          <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Send">
            <Send className="size-4" />
          </Button>
        </form>
        <div className="mt-3">
          <AiNotice />
        </div>
      </SectionCard>
    </AppShell>
  );
}