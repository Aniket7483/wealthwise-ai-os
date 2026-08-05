import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Brain } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState, SectionCard, StatCard } from "@/components/wealth/StatCard";
import { AiNotice, Bullets } from "@/components/market/MarketWidgets";
import { Button } from "@/components/ui/button";
import { useBudgets, useExpenses, useIncomeSources, useProfile } from "@/hooks/useWealthData";
import { analyseExpenses, type ExpenseIntel } from "@/lib/ai.functions";
import { formatMoney, monthKey } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({
    meta: [
      { title: "Expense Intelligence — AI Wealth OS" },
      {
        name: "description",
        content:
          "AI analysis of your spending: overspending flags, recurring subscriptions, month-on-month trends and practical savings ideas.",
      },
      { property: "og:title", content: "Expense Intelligence — AI Wealth OS" },
      { property: "og:description", content: "Understand where the money goes, with AI-detected patterns and trends." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InsightsPage,
});

function InsightsPage() {
  const profile = useProfile();
  const expenses = useExpenses();
  const budgets = useBudgets();
  const income = useIncomeSources();
  const currency = profile.data?.currency ?? "INR";
  const rows = expenses.data ?? [];

  const monthly = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of rows) map.set(monthKey(e.spent_on), (map.get(monthKey(e.spent_on)) ?? 0) + Number(e.amount));
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([month, total]) => ({ month, total }));
  }, [rows]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of rows) map.set(e.category, (map.get(e.category) ?? 0) + Number(e.amount));
    return [...map.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
  }, [rows]);

  const thisMonth = monthly[monthly.length - 1]?.total ?? 0;
  const lastMonth = monthly[monthly.length - 2]?.total ?? 0;
  const monthlyIncome = (income.data ?? []).reduce((a, s) => a + Number(s.monthly_amount), 0);
  const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - thisMonth) / monthlyIncome) * 100 : 0;

  const aiFn = useServerFn(analyseExpenses);
  const ai = useMutation<ExpenseIntel>({
    mutationFn: () =>
      aiFn({
        data: {
          context: JSON.stringify({
            currency,
            monthlyIncome,
            monthlyTotals: monthly,
            byCategory,
            budgets: (budgets.data ?? []).map((b) => ({ category: b.category, limit: b.monthly_limit })),
            recentTransactions: rows.slice(0, 120).map((e) => ({
              date: e.spent_on,
              category: e.category,
              amount: e.amount,
              note: e.note,
            })),
          }),
        },
      }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      title="Expense Intelligence"
      description="AI pattern detection across everything you've logged."
      actions={
        <Button onClick={() => ai.mutate()} disabled={rows.length === 0 || ai.isPending}>
          <Brain className="size-4" />
          {ai.isPending ? "Analysing…" : "Analyse my spending"}
        </Button>
      }
    >
      {rows.length === 0 ? (
        <EmptyState
          title="No expenses logged yet"
          description="Log a few expenses first — the intelligence layer needs data to find patterns in."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="This month" value={formatMoney(thisMonth, currency)} tone="brand" />
            <StatCard
              label="vs last month"
              value={lastMonth > 0 ? `${(((thisMonth - lastMonth) / lastMonth) * 100).toFixed(1)}%` : "—"}
              tone={thisMonth <= lastMonth ? "success" : "danger"}
            />
            <StatCard label="Top category" value={byCategory[0]?.category ?? "—"} hint={formatMoney(byCategory[0]?.total ?? 0, currency)} />
            <StatCard
              label="Savings rate"
              value={monthlyIncome > 0 ? `${savingsRate.toFixed(0)}%` : "—"}
              tone={savingsRate >= 20 ? "success" : savingsRate >= 10 ? "warning" : "danger"}
              hint="Income minus this month's spend"
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <SectionCard title="Monthly trend" description="Total spend over the last 12 months.">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" width={70} />
                    <Tooltip
                      formatter={(v: number) => formatMoney(v, currency)}
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="total" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard title="Category mix" description="All-time spend per category.">
              <div className="space-y-2">
                {byCategory.map((c) => {
                  const max = byCategory[0]?.total ?? 1;
                  return (
                    <div key={c.category} className="grid grid-cols-[minmax(0,120px)_1fr_90px] items-center gap-3">
                      <span className="truncate text-xs">{c.category}</span>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${(c.total / max) * 100}%` }} />
                      </div>
                      <span className="num text-right text-xs text-muted-foreground">
                        {formatMoney(c.total, currency)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          </div>

          {ai.data ? (
            <SectionCard title="AI spending analysis" description={ai.data.summary}>
              <div className="grid gap-5 lg:grid-cols-2">
                <Bullets title="Possible overspending" items={ai.data.overspending} />
                <Bullets title="Recurring & subscriptions" items={ai.data.recurring} />
                <Bullets title="Trends" items={ai.data.trends} />
                <Bullets title="Suggestions" items={ai.data.suggestions} />
              </div>
              <div className="mt-4">
                <AiNotice>
                  AI-generated analysis of your own logged data. Guidance only — you know your context best.
                </AiNotice>
              </div>
            </SectionCard>
          ) : null}
        </>
      )}
    </AppShell>
  );
}