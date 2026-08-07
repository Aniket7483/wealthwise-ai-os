import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { SectionCard, StatCard } from "@/components/wealth/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useBudgets, useExpenses, useProfile, useSaveBudget } from "@/hooks/useWealthData";
import { EXPENSE_CATEGORIES, formatMoney, monthKey } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/budget")({
  head: () => ({
    meta: [
      { title: "Budget — AI Wealth OS" },
      {
        name: "description",
        content: "Set a monthly limit per category and watch live progress against real spending.",
      },
      { property: "og:title", content: "Budget — AI Wealth OS" },
      { property: "og:description", content: "Category limits with live burn tracking." },
    ],
  }),
  component: BudgetPage,
});

function BudgetPage() {
  const profile = useProfile();
  const budgets = useBudgets();
  const expenses = useExpenses();
  const saveBudget = useSaveBudget();
  const currency = profile.data?.currency ?? "INR";
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const thisMonth = monthKey(new Date());

  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of expenses.data ?? []) {
      if (monthKey(row.spent_on) !== thisMonth) continue;
      map.set(row.category, (map.get(row.category) ?? 0) + Number(row.amount));
    }
    return map;
  }, [expenses.data, thisMonth]);

  const limits = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of budgets.data ?? []) map.set(b.category, Number(b.monthly_limit));
    return map;
  }, [budgets.data]);

  const totalLimit = [...limits.values()].reduce((a, b) => a + b, 0);
  const totalSpent = [...spentByCategory.values()].reduce((a, b) => a + b, 0);
  const overCount = EXPENSE_CATEGORIES.filter(
    (c) => (limits.get(c) ?? 0) > 0 && (spentByCategory.get(c) ?? 0) > (limits.get(c) ?? 0),
  ).length;

  async function save(category: string) {
    const raw = drafts[category];
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Enter a valid limit");
      return;
    }
    await saveBudget.mutateAsync({ category, monthly_limit: value });
    toast.success(`${category} budget saved`);
  }

  return (
    <AppShell title="Budget" description="Limits you actually see, checked against real spending.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total budget" value={formatMoney(totalLimit, currency)} tone="brand" />
        <StatCard label="Spent this month" value={formatMoney(totalSpent, currency)} />
        <StatCard
          label="Remaining"
          value={formatMoney(Math.max(totalLimit - totalSpent, 0), currency)}
          tone={totalSpent > totalLimit ? "danger" : "success"}
        />
        <StatCard
          label="Categories over limit"
          value={String(overCount)}
          tone={overCount ? "warning" : "success"}
        />
      </div>

      <SectionCard
        title="Category limits"
        description="Set a monthly cap per category. Blank means untracked."
      >
        <div className="space-y-4">
          {EXPENSE_CATEGORIES.map((category) => {
            const limit = limits.get(category) ?? 0;
            const spent = spentByCategory.get(category) ?? 0;
            const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
            const over = limit > 0 && spent > limit;
            return (
              <div key={category} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{category}</p>
                    <p className="num text-xs text-muted-foreground">
                      {formatMoney(spent, currency)} spent
                      {limit > 0 ? ` of ${formatMoney(limit, currency)}` : " · no limit set"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      className="w-32"
                      aria-label={`${category} monthly limit`}
                      value={drafts[category] ?? (limit ? String(limit) : "")}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [category]: e.target.value }))
                      }
                      placeholder="Limit"
                    />
                    <Button variant="secondary" size="sm" onClick={() => save(category)}>
                      Save
                    </Button>
                  </div>
                </div>
                {limit > 0 ? (
                  <div className="mt-3">
                    <Progress value={pct} />
                    <p
                      className={`mt-1 text-xs ${over ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {over
                        ? `Over by ${formatMoney(spent - limit, currency)}`
                        : `${pct}% used · ${formatMoney(limit - spent, currency)} left`}
                    </p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </SectionCard>
    </AppShell>
  );
}
