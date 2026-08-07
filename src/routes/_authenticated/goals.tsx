import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState, SectionCard, StatCard } from "@/components/wealth/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGoalMutations, useGoals, useProfile } from "@/hooks/useWealthData";
import { formatMoney } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({
    meta: [
      { title: "Goals — AI Wealth OS" },
      {
        name: "description",
        content: "Track emergency fund, home, travel and retirement goals with live progress.",
      },
      { property: "og:title", content: "Goals — AI Wealth OS" },
      { property: "og:description", content: "Turn intentions into funded targets." },
    ],
  }),
  component: GoalsPage,
});

const PRIORITIES = ["high", "medium", "low"];

function GoalsPage() {
  const profile = useProfile();
  const goals = useGoals();
  const { add, update, remove } = useGoalMutations();
  const currency = profile.data?.currency ?? "INR";

  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [date, setDate] = useState("");
  const [priority, setPriority] = useState("high");

  const rows = goals.data ?? [];
  const totalTarget = rows.reduce((s, g) => s + Number(g.target_amount), 0);
  const totalSaved = rows.reduce((s, g) => s + Number(g.current_amount), 0);
  const completed = rows.filter((g) => Number(g.current_amount) >= Number(g.target_amount)).length;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const targetValue = Number(target);
    if (!name.trim() || !Number.isFinite(targetValue) || targetValue <= 0) {
      toast.error("Enter a goal name and a positive target");
      return;
    }
    await add.mutateAsync({
      name: name.trim().slice(0, 80),
      target_amount: targetValue,
      current_amount: Number(current) || 0,
      target_date: date || null,
      priority,
    });
    setName("");
    setTarget("");
    setCurrent("");
    setDate("");
    toast.success("Goal created");
  }

  return (
    <AppShell title="Goals" description="Named targets, funded month by month.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total target" value={formatMoney(totalTarget, currency)} tone="brand" />
        <StatCard label="Total saved" value={formatMoney(totalSaved, currency)} tone="success" />
        <StatCard
          label="Overall progress"
          value={`${totalTarget ? Math.round((totalSaved / totalTarget) * 100) : 0}%`}
        />
        <StatCard label="Goals reached" value={`${completed}/${rows.length}`} />
      </div>

      <SectionCard
        title="New goal"
        description="Emergency fund, house deposit, travel, retirement…"
      >
        <form className="grid gap-3 md:grid-cols-5" onSubmit={submit}>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="goal-name">Goal name</Label>
            <Input
              id="goal-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder="Emergency fund"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-target">Target</Label>
            <Input
              id="goal-target"
              type="number"
              min={0}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="600000"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-current">Saved so far</Label>
            <Input
              id="goal-current"
              type="number"
              min={0}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-date">Target date</Label>
            <Input
              id="goal-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-priority">Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger id="goal-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end md:col-span-4">
            <Button type="submit" className="gap-2" disabled={add.isPending}>
              <Plus className="size-4" /> Create goal
            </Button>
          </div>
        </form>
      </SectionCard>

      {rows.length === 0 ? (
        <EmptyState
          title="No goals yet"
          description="Start with an emergency fund worth six months of expenses."
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((goal) => {
            const pct = Number(goal.target_amount)
              ? Math.min(
                  100,
                  Math.round((Number(goal.current_amount) / Number(goal.target_amount)) * 100),
                )
              : 0;
            return (
              <SectionCard
                key={goal.id}
                title={goal.name}
                description={
                  goal.target_date
                    ? `Target ${new Date(goal.target_date).toLocaleDateString()} · ${goal.priority} priority`
                    : `${goal.priority} priority`
                }
                actions={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${goal.name}`}
                    onClick={() => remove.mutate(goal.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                }
              >
                <p className="num text-2xl font-semibold">
                  {formatMoney(Number(goal.current_amount), currency)}
                </p>
                <p className="text-sm text-muted-foreground">
                  of {formatMoney(Number(goal.target_amount), currency)}
                </p>
                <div className="mt-4">
                  <Progress value={pct} />
                  <p className="mt-1 text-xs text-muted-foreground">{pct}% funded</p>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    aria-label={`Update saved amount for ${goal.name}`}
                    defaultValue={Number(goal.current_amount)}
                    onBlur={(e) => {
                      const value = Number(e.target.value);
                      if (!Number.isFinite(value) || value < 0) return;
                      if (value === Number(goal.current_amount)) return;
                      update.mutate({ id: goal.id, current_amount: value });
                    }}
                  />
                  <span className="text-xs text-muted-foreground">saved</span>
                </div>
              </SectionCard>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
