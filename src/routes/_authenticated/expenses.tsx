import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState, SectionCard, StatCard } from "@/components/wealth/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useExpenseMutations, useExpenses, useProfile } from "@/hooks/useWealthData";
import { EXPENSE_CATEGORIES, formatMoney, monthKey } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({
    meta: [
      { title: "Expenses — AI Wealth OS" },
      {
        name: "description",
        content: "Log and categorise every expense, then see exactly where the month went.",
      },
      { property: "og:title", content: "Expenses — AI Wealth OS" },
      { property: "og:description", content: "Track spending by category with zero friction." },
    ],
  }),
  component: Expenses,
});

function Expenses() {
  const profile = useProfile();
  const expenses = useExpenses();
  const { add, remove } = useExpenseMutations();
  const currency = profile.data?.currency ?? "INR";

  const [category, setCategory] = useState<string>("Food");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [spentOn, setSpentOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [filter, setFilter] = useState<string>("all");

  const thisMonth = monthKey(new Date());
  const rows = useMemo(() => expenses.data ?? [], [expenses.data]);

  const stats = useMemo(() => {
    const monthRows = rows.filter((r) => monthKey(r.spent_on) === thisMonth);
    const monthTotal = monthRows.reduce((s, r) => s + Number(r.amount), 0);
    const byCategory = new Map<string, number>();
    for (const r of monthRows) {
      byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + Number(r.amount));
    }
    const top = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
    const days = new Date().getDate();
    return {
      monthTotal,
      count: monthRows.length,
      dailyAvg: days ? monthTotal / days : 0,
      top: top ? `${top[0]} · ${formatMoney(top[1], currency)}` : "—",
    };
  }, [rows, thisMonth, currency]);

  const visible = filter === "all" ? rows : rows.filter((r) => r.category === filter);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a positive amount");
      return;
    }
    const trimmed = note.trim().slice(0, 140);
    await add.mutateAsync({
      category,
      amount: value,
      spent_on: spentOn,
      ...(trimmed ? { note: trimmed } : {}),
    });
    setAmount("");
    setNote("");
    toast.success("Expense logged");
  }

  return (
    <AppShell title="Expenses" description="Fast logging, honest categories, clear totals.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Spent this month"
          value={formatMoney(stats.monthTotal, currency)}
          tone="brand"
        />
        <StatCard label="Transactions" value={String(stats.count)} />
        <StatCard label="Daily average" value={formatMoney(stats.dailyAvg, currency)} />
        <StatCard label="Top category" value={stats.top} />
      </div>

      <SectionCard title="Log an expense" description="Takes about five seconds.">
        <form className="grid gap-3 md:grid-cols-5" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exp-amount">Amount</Label>
            <Input
              id="exp-amount"
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="450"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exp-date">Date</Label>
            <Input
              id="exp-date"
              type="date"
              value={spentOn}
              onChange={(e) => setSpentOn(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exp-note">Note</Label>
            <Input
              id="exp-note"
              value={note}
              maxLength={140}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full gap-2" disabled={add.isPending}>
              <Plus className="size-4" /> Add
            </Button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Recent expenses"
        description="Newest first"
        actions={
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {EXPENSE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      >
        {visible.length === 0 ? (
          <EmptyState
            title="No expenses here"
            description="Log your first expense above to start building the picture."
          />
        ) : (
          <div className="divide-y divide-border">
            {visible.slice(0, 60).map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {row.category}
                    {row.note ? (
                      <span className="font-normal text-muted-foreground"> · {row.note}</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(row.spent_on).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="num text-sm font-medium">
                    {formatMoney(Number(row.amount), currency)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete expense"
                    onClick={() => remove.mutate(row.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </AppShell>
  );
}
