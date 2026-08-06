import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { useChatThreads, useThreadMutations } from "@/hooks/useChatThreads";

export const Route = createFileRoute("/_authenticated/assistant/")({
  head: () => ({
    meta: [
      { title: "AI Assistant — AI Wealth OS" },
      {
        name: "description",
        content:
          "Chat with your personal CFO about markets, portfolio, spending and goals — with saved conversation history.",
      },
      { property: "og:title", content: "AI Assistant — AI Wealth OS" },
      { property: "og:description", content: "An AI assistant that can see your live market and finance data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssistantIndex,
});

function AssistantIndex() {
  const navigate = useNavigate();
  const threads = useChatThreads();
  const { createThread } = useThreadMutations();
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (threads.isLoading || bootstrapped.current) return;
    bootstrapped.current = true;
    const first = threads.data?.[0];
    if (first) {
      void navigate({ to: "/assistant/$threadId", params: { threadId: first.id }, replace: true });
      return;
    }
    createThread
      .mutateAsync(undefined)
      .then((id) => navigate({ to: "/assistant/$threadId", params: { threadId: id }, replace: true }))
      .catch((error: Error) => toast.error(error.message));
  }, [threads.isLoading, threads.data, createThread, navigate]);

  return (
    <AppShell title="AI Assistant" description="Opening your conversation…">
      <div className="surface h-64 animate-pulse bg-muted/40" />
    </AppShell>
  );
}