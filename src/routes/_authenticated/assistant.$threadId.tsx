import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { MessagesSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/layout/AppShell";
import { SectionCard } from "@/components/wealth/StatCard";
import { AiNotice } from "@/components/market/MarketWidgets";
import { ThreadList } from "@/components/assistant/ThreadList";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAssistantContext } from "@/hooks/useAssistantContext";
import { useChatMessages, useChatThreads, useThreadMutations } from "@/hooks/useChatThreads";
import { askAssistant } from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/assistant/$threadId")({
  head: () => ({
    meta: [
      { title: "AI Assistant — AI Wealth OS" },
      {
        name: "description",
        content:
          "Your saved conversation with the AI personal CFO — markets, portfolio, spending and goals, answered from live data.",
      },
      { property: "og:title", content: "AI Assistant — AI Wealth OS" },
      { property: "og:description", content: "Saved AI conversations grounded in your live financial data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssistantThread,
});

const SUGGESTIONS = [
  "How is my portfolio positioned right now?",
  "What moved the Indian market today?",
  "Where am I overspending this month?",
  "Am I on track for my goals?",
];

function AssistantThread() {
  const { threadId } = useParams({ from: "/_authenticated/assistant/$threadId" });
  const navigate = useNavigate();

  const threads = useChatThreads();
  const messages = useChatMessages(threadId);
  const { createThread, deleteThread, appendMessage, renameThread } = useThreadMutations();
  const context = useAssistantContext();
  const ask = useServerFn(askAssistant);

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    boxRef.current?.focus();
  }, [threadId, busy]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data, busy]);

  const rows = messages.data ?? [];

  async function send(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    try {
      await appendMessage.mutateAsync({ thread_id: threadId, role: "user", content: text });
      if (rows.length === 0) {
        await renameThread.mutateAsync({
          id: threadId,
          title: text.length > 48 ? `${text.slice(0, 48)}…` : text,
        });
      }
      const conversation = [...rows.map((m) => ({ role: m.role, text: m.content })), { role: "user", text }]
        .slice(-8)
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`)
        .join("\n");
      const reply = await ask({ data: { question: conversation, context } });
      await appendMessage.mutateAsync({
        thread_id: threadId,
        role: "assistant",
        content: reply.answer,
        bullets: reply.bullets ?? [],
        follow_ups: reply.followUps ?? [],
      });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function newThread() {
    try {
      const id = await createThread.mutateAsync(undefined);
      await navigate({ to: "/assistant/$threadId", params: { threadId: id } });
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function removeThread(id: string) {
    await deleteThread.mutateAsync(id);
    if (id !== threadId) return;
    const next = (threads.data ?? []).find((t) => t.id !== id);
    if (next) await navigate({ to: "/assistant/$threadId", params: { threadId: next.id }, replace: true });
    else await navigate({ to: "/assistant", replace: true });
  }

  return (
    <AppShell
      title="AI Assistant"
      description="Your personal CFO — grounded in your live market and finance data."
    >
      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <div className="lg:max-h-[70vh]">
          <ThreadList
            threads={threads.data ?? []}
            activeId={threadId}
            onCreate={() => void newThread()}
            onDelete={(id) => void removeThread(id)}
            creating={createThread.isPending}
          />
        </div>

        <SectionCard
          title={threads.data?.find((t) => t.id === threadId)?.title ?? "Conversation"}
          description="Saved to your account — pick it back up any time."
        >
          <div key={threadId} className="max-h-[52vh] space-y-4 overflow-y-auto pr-1">
            {rows.length === 0 && !busy ? (
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

            {rows.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <p className="max-w-[80%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground">
                    {m.content}
                  </p>
                </div>
              ) : (
                <div key={m.id} className="space-y-2">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                  {m.bullets.length ? (
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {m.bullets.map((b, j) => (
                        <li key={j} className="flex gap-2">
                          <span className="text-primary">•</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {m.follow_ups.length ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {m.follow_ups.map((f) => (
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
      </div>
    </AppShell>
  );
}