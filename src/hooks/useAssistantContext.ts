import { useMemo } from "react";
import { useHoldings, useMarketOverview } from "@/hooks/useMarketData";
import { useExpenses, useGoals, useIncomeSources, useProfile } from "@/hooks/useWealthData";

/** Serialised live app context handed to the AI assistant on every question. */
export function useAssistantContext() {
  const profile = useProfile();
  const holdings = useHoldings();
  const expenses = useExpenses();
  const goals = useGoals();
  const income = useIncomeSources();
  const overview = useMarketOverview();

  return useMemo(
    () =>
      JSON.stringify({
        currency: profile.data?.currency ?? "INR",
        riskProfile: profile.data?.risk_profile ?? null,
        monthlyIncome: (income.data ?? []).reduce((a, s) => a + Number(s.monthly_amount), 0),
        holdings: (holdings.data ?? []).map((h) => ({
          symbol: h.symbol,
          name: h.name,
          qty: h.quantity,
          avgPrice: h.avg_price,
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
        markets: overview.data
          ? (overview.data.groups ?? []).flatMap((g) =>
              g.quotes.map((q) => ({
                name: q.name,
                dayPct: Number(q.changePct.toFixed(2)),
                monthPct: Number(q.monthPct.toFixed(2)),
              })),
            )
          : "live market data still loading — do not comment on today's moves",
      }),
    [profile.data, income.data, holdings.data, goals.data, expenses.data, overview.data],
  );
}
