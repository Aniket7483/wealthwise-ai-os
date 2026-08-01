import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Trash2, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState, SectionCard, StatCard } from "@/components/wealth/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAllocation,
  useIncomeMutations,
  useIncomeSources,
  useProfile,
  useSaveAllocation,
  type Allocation,
} from "@/hooks/useWealthData";
import { ALLOCATION_BUCKETS, INCOME_KINDS, formatMoney, type AllocationKey } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/salary")({
  head: () => ({
    meta: [
      { title: "Salary planner — AI Wealth OS" },
      {
        name: "description",
        content:
          "Split every paycheque across savings, investments, emergency fund, tax reserve and spending.",
      },
      { property: "og:title", content: "Salary planner — AI Wealth OS" },
      { property: "og:description", content: "Give every rupee of your income a job." },
    ],
  }),
  component: SalaryPlanner,
});

const DEFAULTS: Record<AllocationKey, number> = {
  savings_pct: 15,
  investments_pct: 25,
  emergency_pct: 10,
  tax_pct: 10,
  personal_pct: 20,
  family_pct: 5,
  emi_pct: 10,
  insurance_pct: 5,
};

function SalaryPlanner() {
  const profile = useProfile();
  const income = useIncomeSources();
  const allocation = useAllocation();
  const saveAllocation = useSaveAllocation();
  const { add, remove } = useIncomeMutations();
  const currency = profile.data?.currency ?? "INR";

  const [draft, setDraft] = useState<Record<AllocationKey, number>>(DEFAULTS);
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState("salary");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (!allocation.data) return;
    const next = { ...DEFAULTS };
    for (const bucket of ALLOCATION_BUCKETS) {
      next[bucket.key] = Number((allocation.data as Allocation)[bucket.key]);
    }
    setDraft(next);
  }, [allocation.data]);

  const total = useMemo(
    () => (income.data ?? []).reduce((sum, i) => sum + Number(i.monthly_amount), 0),
    [income.data],
  );
  const allocated = ALLOCATION_BUCKETS.reduce((sum, b) => sum + draft[b.key], 0);
  const remaining = 100 - allocated;

  async function addIncome(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(amount);
    if (!label.trim() || !Number.isFinite(value) || value <= 0) {
      toast.error("Enter a label and a positive amount");
      return;
    }
    await add.mutateAsync({ label: label.trim().slice(0, 60), kind, monthly_amount: value });
    setLabel("");
    setAmount("");
    toast.success("Income source added");
  }

  return (
    <AppShell
      title="Salary planner"
      description="Every rupee gets a job before the month starts."
      actions={
        <Button
          onClick={async () => {
            await saveAllocation.mutateAsync(draft);
            toast.success("Allocation saved");
          }}
          disabled={saveAllocation.isPending}
        >
          Save plan
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total monthly income" value={formatMoney(total, currency)} tone="brand" />
        <StatCard
          label="Allocated"
          value={`${allocated}%`}
          tone={allocated > 100 ? "danger" : allocated === 100 ? "success" : "warning"}
        />
        <StatCard
          label="Unallocated cash"
          value={formatMoney((total * Math.max(remaining, 0)) / 100, currency)}
          hint={`${remaining}% of income`}
        />
        <StatCard
          label="Long-term pot"
          value={formatMoney(
            (total * (draft.savings_pct + draft.investments_pct + draft.emergency_pct)) / 100,
            currency,
          )}
          tone="success"
          hint="Savings + investments + emergency"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <SectionCard title="Income sources" description="Salary, bonus, freelance, rent and more">
          <form className="grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={addIncome}>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="label">Label</Label>
                <Input
                  id="label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Base salary"
                  maxLength={60}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kind">Type</Label>
                <Select value={kind} onValueChange={setKind}>
                  <SelectTrigger id="kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INCOME_KINDS.map((k) => (
                      <SelectItem key={k.value} value={k.value}>
                        {k.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="amount">Monthly amount</Label>
                <Input
                  id="amount"
                  type="number"
                  min={0}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="85000"
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full gap-2" disabled={add.isPending}>
                  <Plus className="size-4" /> Add
                </Button>
              </div>
            </div>
          </form>

          <div className="mt-5 space-y-2">
            {(income.data ?? []).length === 0 ? (
              <EmptyState
                title="No income yet"
                description="Add your salary first — everything else is calculated from it."
              />
            ) : (
              (income.data ?? []).map((source) => (
                <div
                  key={source.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{source.label}</p>
                    <p className="text-xs text-muted-foreground capitalize">{source.kind}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="num text-sm font-medium">
                      {formatMoney(Number(source.monthly_amount), currency)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${source.label}`}
                      onClick={() => remove.mutate(source.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Allocation plan"
          description="Recommended split, fully customisable. Aim for 100%."
          actions={
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => setDraft(DEFAULTS)}>
              <RotateCcw className="size-4" /> Reset
            </Button>
          }
        >
          <div className="space-y-5">
            {ALLOCATION_BUCKETS.map((bucket) => (
              <div key={bucket.key}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span>{bucket.label}</span>
                  <span className="num text-muted-foreground">
                    {draft[bucket.key]}% ·{" "}
                    {formatMoney((total * draft[bucket.key]) / 100, currency)}
                  </span>
                </div>
                <Slider
                  value={[draft[bucket.key]]}
                  min={0}
                  max={60}
                  step={1}
                  onValueChange={([value]) =>
                    setDraft((prev) => ({ ...prev, [bucket.key]: value ?? 0 }))
                  }
                />
              </div>
            ))}
            <p
              className={
                remaining === 0
                  ? "text-sm text-success"
                  : remaining < 0
                    ? "text-sm text-destructive"
                    : "text-sm text-warning"
              }
            >
              {remaining === 0
                ? "Perfectly allocated."
                : remaining > 0
                  ? `${remaining}% still unassigned — park it in savings or investments.`
                  : `Over-allocated by ${Math.abs(remaining)}%.`}
            </p>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}