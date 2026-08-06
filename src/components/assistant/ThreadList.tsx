import { Link } from "@tanstack/react-router";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatThread } from "@/hooks/useChatThreads";

export function ThreadList({
  threads,
  activeId,
  onCreate,
  onDelete,
  creating,
}: {
  threads: ChatThread[];
  activeId?: string;
  onCreate: () => void;
  onDelete: (id: string) => void;
  creating?: boolean;
}) {
  return (
    <div className="surface flex h-full flex-col p-3">
      <Button className="w-full justify-start gap-2" onClick={onCreate} disabled={creating}>
        <Plus className="size-4" />
        New conversation
      </Button>
      <div className="mt-3 space-y-1 overflow-y-auto">
        {threads.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            No conversations yet.
          </p>
        ) : null}
        {threads.map((t) => (
          <div
            key={t.id}
            className={cn(
              "group flex items-center gap-1 rounded-lg px-1 transition-colors",
              activeId === t.id ? "bg-primary/10" : "hover:bg-muted/60",
            )}
          >
            <Link
              to="/assistant/$threadId"
              params={{ threadId: t.id }}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-sm",
                activeId === t.id ? "font-medium text-primary" : "text-muted-foreground",
              )}
            >
              <MessageSquare className="size-3.5 shrink-0" />
              <span className="truncate">{t.title}</span>
            </Link>
            <button
              aria-label={`Delete ${t.title}`}
              onClick={() => onDelete(t.id)}
              className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}