import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, LineChart, PiggyBank, Target, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Wealth OS — Your personal CFO" },
      {
        name: "description",
        content:
          "Plan your salary, track expenses, hold a budget and fund your goals — one calm, private money workspace.",
      },
      { property: "og:title", content: "AI Wealth OS — Your personal CFO" },
      {
        property: "og:description",
        content: "Salary planning, expenses, budgets and goals in one premium workspace.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Wallet,
    title: "Salary planning",
    body: "Split every paycheque across savings, investments, tax and spending before it disappears.",
  },
  {
    icon: LineChart,
    title: "Expense clarity",
    body: "Category-level tracking with monthly trends, so the story of your money is obvious.",
  },
  {
    icon: PiggyBank,
    title: "Budgets that hold",
    body: "Per-category limits checked live against what you actually spent this month.",
  },
  {
    icon: Target,
    title: "Funded goals",
    body: "Emergency fund, home, travel — named targets with honest progress, not vibes.",
  },
];

function Landing() {
  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-lg font-semibold tracking-tight">AI Wealth OS</span>
        <Button asChild variant="ghost">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10 md:pt-20">
        <p className="text-sm font-medium tracking-widest text-primary uppercase">Personal CFO</p>
        <h1 className="font-display mt-4 max-w-3xl text-4xl leading-tight font-semibold tracking-tight text-balance md:text-6xl">
          Every rupee gets a job. Every month makes sense.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          A private workspace for your salary, spending, budgets and goals — with a transparent
          financial health score built from your own numbers.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg" className="gap-2">
            <Link to="/auth">
              Create your account <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Informational tooling only — not personalised financial advice.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="surface p-6">
              <feature.icon className="size-5 text-primary" />
              <h2 className="mt-4 text-base font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        AI Wealth OS · Built for clear, calm money decisions.
      </footer>
    </main>
  );
}
