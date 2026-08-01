import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState, SectionCard, StatCard } from "@/components/wealth/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  useAllocation,
  useBudgets,
  useExpenses,
  useGoals,
  useIncomeSources,
  useProfile,
} from "@/hooks/useWealthData";
import {
  financialHealthScore,
  formatCompact,
  formatMoney,
  lastMonths,
  monthKey,
  monthLabel,
  scoreBand,
} from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — AI Wealth OS" },
      {
        name: "description",
        content:
          "See salary, expenses, savings, net worth trend and your financial health score in one dashboard.",
      },
      { property: "og:title", content: "Dashboard — AI Wealth OS" },
      { property: "og:description", content: "Your complete money picture in one place." },
    ],
  }),
  component: Dashboard,
});

const PIE_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

function Dashboard() {
  const profile = useProfile();
  const income = useIncomeSources();
  const expenses = useExpenses();
  const goals = useGoals();
  const budgets = useBudgets();
  const allocation = useAllocation();

  const currency = profile.data?.currency ?? "INR";
  const loading = income.isLoading || expenses.isLoading || goals.isLoading;

  const model = useMemo(() => {
    const incomes = income.data ?? [];
    const rows = expenses.data ?? [];
    const goalRows = goals.data ?? [];
    const plan = allocation.data;

    const monthlyIncome = incomes.reduce((sum, i) => sum + Number(i.monthly_amount), 0);
    const months = lastMonths(6);
    const thisMonth = monthKey(new Date());

    const spendByMonth = new Map<string, number>();
    const spendByCategory = new Map<string, number>();
    for (const row of rows) {
      const key = monthKey(row.spent_on);
      spendByMonth.set(key, (spendByMonth.get(key) ?? 0) + Number(row.amount));
      if (key === thisMonth) {
        spendByCategory.set(
          row.category,
          (spendByCategory.get(row.category) ?? 0) + Number(row.amount),
        );
      }
    }

    const monthlyExpenses = spendByMonth.get(thisMonth) ?? 0;
    const monthlySavings = monthlyIncome - monthlyExpenses;
    const investments = plan ? (monthlyIncome * Number(plan.investments_pct)) / 100 : 0;
    const emergencyTarget = plan ? (monthlyIncome * Number(plan.emergency_pct)) / 100 : 0;
    const savedTotal = goalRows.reduce((sum, g) => sum + Number(g.current_amount), 0);
    const emergencyGoal = goalRows.find((g) => /emergency/i.test(g.name));
    const emergencyFund = emergencyGoal ? Number(emergencyGoal.current_amount) : 0;

    const cashflow = months.map((key) => {
      const spent = spendByMonth.get(key) ?? 0;
      return {
        month: monthLabel(key),
        income: monthlyIncome,
        expenses: spent,
        savings: Math.max(monthlyIncome - spent, 0),
      };
    });

    let running = 0;
    const netWorth = cashflow.map((point) => {
      running += point.savings;
      return { month: point.month, netWorth: running + savedTotal };
    });

    const categories = [...spendByCategory.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const incomeBreakdown = incomes.map((i) => ({
      name: i.label,
      value: Number(i.monthly_amount),
    }));

    const goalProgress = goalRows.length
      ? goalRows.reduce(
          (sum, g) =>
            sum + (Number(g.target_amount) > 0 ? Number(g.current_amount) / Number(g.target_amount) : 0),
          0,
        ) / goalRows.length
      : 0;

    const health = financialHealthScore({
      income: monthlyIncome,
      expenses: monthlyExpenses,
      savings: monthlySavings,
      emergencyFund,
      goalProgress,
    });

    const budgetTotal = (budgets.data ?? []).reduce(
      (sum, b) => sum + Number(b.monthly_limit),
      0,
    );

    return {
      monthlyIncome,
      monthlyExpenses,
      monthlySavings,
      investments,
      emergencyTarget,
      emergencyFund,
      savedTotal,
      cashflow,
      netWorth,
      categories,
      incomeBreakdown,
      health,
      goalProgress,
      budgetTotal,
      hasData: incomes.length > 0 || rows.length > 0,
    };
  }, [income.data, expenses.data, goals.data, allocation.data, budgets.data]);

  const band = scoreBand(model.health);
  const wealthScore = Math.round(
    Math.max(0, Math.min(100, model.health * 0.7 + model.goalProgress * 30)),
  );

  if (loading) {
    return (
      <AppShell title="Dashboard" description="Loading your financial picture…">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </AppShell>
    );
  }

  return (
    <AppShell
      title={`Hello${profile.data?.full_name ? `, ${profile.data.full_name.split(" ")[0]}` : ""}`}
      description="Your money at a glance — updated live from your own records."
    >
      {!model.hasData ? (
        <EmptyState
          title="No financial data yet"
          description="Add your income in the Salary planner and log a few expenses — the dashboard fills in instantly."
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Monthly salary"
          value={formatMoney(model.monthlyIncome, currency)}
          hint="All income sources"
          tone="brand"
        />
        <StatCard
          label="Monthly expenses"
          value={formatMoney(model.monthlyExpenses, currency)}
          hint="This calendar month"
        />
        <StatCard
          label="Monthly savings"
          value={formatMoney(model.monthlySavings, currency)}
          tone={model.monthlySavings >= 0 ? "success" : "danger"}
          hint={
            model.monthlyIncome
              ? `${Math.round((model.monthlySavings / model.monthlyIncome) * 100)}% savings rate`
              : "Add income to compute"
          }
        />
        <StatCard
          label="Planned investments"
          value={formatMoney(model.investments, currency)}
          hint="From your allocation plan"
        />
        <StatCard
          label="Net worth (tracked)"
          value={formatMoney(model.savedTotal, currency)}
          hint="Sum of goal balances"
        />
        <StatCard
          label="Emergency fund"
          value={formatMoney(model.emergencyFund, currency)}
          tone={model.emergencyFund >= model.monthlyExpenses * 6 ? "success" : "warning"}
          hint={
            model.monthlyExpenses
              ? `${(model.emergencyFund / model.monthlyExpenses).toFixed(1)} months of runway`
              : "Log expenses to compute runway"
          }
        />
        <StatCard
          label="Cash available"
          value={formatMoney(Math.max(model.monthlySavings, 0), currency)}
          hint="Unallocated this month"
        />
        <StatCard
          label="Monthly budget"
          value={formatMoney(model.budgetTotal, currency)}
          hint={
            model.budgetTotal
              ? `${Math.round((model.monthlyExpenses / model.budgetTotal) * 100)}% used`
              : "No budgets set yet"
          }
        />
        <StatCard
          label="Financial health"
          value={`${model.health}/100`}
          tone={band.tone === "danger" ? "danger" : band.tone}
          hint={band.label}
        />
        <StatCard
          label="AI wealth score"
          value={`${wealthScore}/100`}
          tone="brand"
          hint="Estimate, not a guarantee"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <SectionCard
          title="Cash flow"
          description="Income vs expenses over the last 6 months"
          className="xl:col-span-2"
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={model.cashflow}>
                <defs>
                  <linearGradient id="inc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-5)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--color-chart-5)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis
                  tickFormatter={(v: number) => formatCompact(v, currency)}
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  width={70}
                />
                <Tooltip formatter={(v: number) => formatMoney(Number(v), currency)} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="income"
                  stroke="var(--color-chart-1)"
                  fill="url(#inc)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  stroke="var(--color-chart-5)"
                  fill="url(#exp)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Expense categories" description="This month's spending mix">
          {model.categories.length === 0 ? (
            <EmptyState
              title="Nothing logged yet"
              description="Log expenses to see where your money actually goes."
            />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={model.categories}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {model.categories.map((entry, index) => (
                      <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatMoney(Number(v), currency)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Income breakdown" description="Where your money comes from">
          {model.incomeBreakdown.length === 0 ? (
            <EmptyState
              title="No income sources"
              description="Add salary, freelance or rental income in the Salary planner."
            />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={model.incomeBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis
                    tickFormatter={(v: number) => formatCompact(v, currency)}
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                    width={70}
                  />
                  <Tooltip formatter={(v: number) => formatMoney(Number(v), currency)} />
                  <Bar dataKey="value" fill="var(--color-chart-2)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Savings trend" description="Monthly surplus after expenses">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={model.cashflow}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis
                  tickFormatter={(v: number) => formatCompact(v, currency)}
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  width={70}
                />
                <Tooltip formatter={(v: number) => formatMoney(Number(v), currency)} />
                <Line
                  type="monotone"
                  dataKey="savings"
                  stroke="var(--color-chart-3)"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Net worth trend" description="Cumulative tracked savings">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={model.netWorth}>
                <defs>
                  <linearGradient id="nw" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis
                  tickFormatter={(v: number) => formatCompact(v, currency)}
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  width={70}
                />
                <Tooltip formatter={(v: number) => formatMoney(Number(v), currency)} />
                <Area
                  type="monotone"
                  dataKey="netWorth"
                  stroke="var(--color-chart-2)"
                  fill="url(#nw)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Financial health breakdown"
        description="A transparent, rule-based score — savings rate, burn rate, emergency runway and goal progress."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <ScoreRow
              label="Savings rate"
              value={
                model.monthlyIncome ? (model.monthlySavings / model.monthlyIncome) * 100 : 0
              }
            />
            <ScoreRow
              label="Spending discipline"
              value={
                model.monthlyIncome
                  ? 100 - (model.monthlyExpenses / model.monthlyIncome) * 100
                  : 0
              }
            />
            <ScoreRow
              label="Emergency runway"
              value={
                model.monthlyExpenses
                  ? (model.emergencyFund / (model.monthlyExpenses * 6)) * 100
                  : 0
              }
            />
            <ScoreRow label="Goal progress" value={model.goalProgress * 100} />
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            This score is generated from your own numbers using fixed rules, not a prediction of
            future returns. It highlights where attention is likely to help most — it is not
            personalised financial advice, and outcomes always carry uncertainty. Consider a
            qualified adviser before acting on large financial decisions.
          </p>
        </div>
      </SectionCard>
    </AppShell>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="num text-muted-foreground">{pct}%</span>
      </div>
      <Progress value={pct} />
    </div>
  );
}