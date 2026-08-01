export type ExpenseCategory =
  | "Food"
  | "Travel"
  | "Fuel"
  | "Shopping"
  | "Entertainment"
  | "Subscriptions"
  | "Healthcare"
  | "Education"
  | "Rent"
  | "Utilities"
  | "Loan Payments"
  | "Family Support"
  | "Miscellaneous";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Food",
  "Travel",
  "Fuel",
  "Shopping",
  "Entertainment",
  "Subscriptions",
  "Healthcare",
  "Education",
  "Rent",
  "Utilities",
  "Loan Payments",
  "Family Support",
  "Miscellaneous",
];

export const INCOME_KINDS = [
  { value: "salary", label: "Salary" },
  { value: "bonus", label: "Bonus" },
  { value: "freelance", label: "Freelance" },
  { value: "rental", label: "Rental" },
  { value: "other", label: "Other" },
] as const;

export const ALLOCATION_BUCKETS = [
  { key: "savings_pct", label: "Savings" },
  { key: "investments_pct", label: "Investments" },
  { key: "emergency_pct", label: "Emergency fund" },
  { key: "tax_pct", label: "Tax reserve" },
  { key: "personal_pct", label: "Personal spending" },
  { key: "family_pct", label: "Family contribution" },
  { key: "emi_pct", label: "EMI" },
  { key: "insurance_pct", label: "Insurance" },
] as const;

export type AllocationKey = (typeof ALLOCATION_BUCKETS)[number]["key"];

export type AllocationPlan = Record<AllocationKey, number> & { user_id: string };

export function formatMoney(value: number, currency = "INR") {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatCompact(value: number, currency = "INR") {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);
}

export function monthKey(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string) {
  const parts = key.split("-");
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
  return d.toLocaleDateString(undefined, { month: "short" });
}

export function lastMonths(count: number) {
  const now = new Date();
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    keys.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  return keys;
}

/**
 * Heuristic wellbeing score (0-100). Deterministic, explainable, not advice.
 */
export function financialHealthScore(input: {
  income: number;
  expenses: number;
  savings: number;
  emergencyFund: number;
  goalProgress: number;
}) {
  const { income, expenses, savings, emergencyFund, goalProgress } = input;
  if (income <= 0) return 0;
  const savingsRate = Math.max(0, Math.min(1, savings / income));
  const burnRatio = Math.max(0, Math.min(1, expenses / income));
  const runwayMonths = expenses > 0 ? emergencyFund / expenses : 0;
  const runway = Math.max(0, Math.min(1, runwayMonths / 6));
  const goals = Math.max(0, Math.min(1, goalProgress));
  const score = savingsRate * 40 + (1 - burnRatio) * 25 + runway * 25 + goals * 10;
  return Math.round(Math.max(0, Math.min(100, score)));
}

export function scoreBand(score: number) {
  if (score >= 80) return { label: "Excellent", tone: "success" as const };
  if (score >= 60) return { label: "Healthy", tone: "success" as const };
  if (score >= 40) return { label: "Needs attention", tone: "warning" as const };
  return { label: "At risk", tone: "danger" as const };
}