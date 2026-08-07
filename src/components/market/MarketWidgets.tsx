import type { ReactNode } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { formatPct, formatPrice, toneFor, type Quote } from "@/lib/market";

export function Sparkline({ values, positive }: { values: number[]; positive: boolean }) {
  const data = values.map((close, index) => ({ index, close }));
  if (data.length < 2) return <div className="h-10" />;
  const color = positive ? "var(--color-success, #10b981)" : "var(--color-destructive, #ef4444)";
  return (
    <div className="h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`spark-${positive ? "up" : "down"}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="close"
            stroke={color}
            strokeWidth={1.6}
            fill={`url(#spark-${positive ? "up" : "down"})`}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function QuoteTile({ quote }: { quote: Quote }) {
  const up = quote.changePct >= 0;
  if (quote.error || !Number.isFinite(quote.price)) {
    return (
      <div className="surface p-4">
        <p className="text-sm font-medium">{quote.name}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {quote.error ?? "Live data unavailable"}
        </p>
      </div>
    );
  }
  return (
    <div className="surface p-4 transition-shadow hover:shadow-[var(--shadow-lift)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{quote.name}</p>
          <p className="text-[11px] text-muted-foreground">{quote.symbol}</p>
        </div>
        <span className={cn("num text-sm font-semibold", toneFor(quote.changePct))}>
          {formatPct(quote.changePct)}
        </span>
      </div>
      <p className="num mt-2 text-xl font-semibold">{formatPrice(quote.price, quote.currency)}</p>
      <Sparkline values={quote.spark} positive={up} />
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>
          1W <span className={toneFor(quote.weekPct)}>{formatPct(quote.weekPct)}</span>
        </span>
        <span>
          1M <span className={toneFor(quote.monthPct)}>{formatPct(quote.monthPct)}</span>
        </span>
      </div>
    </div>
  );
}

export function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="num text-foreground">{value}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "positive" | "negative" | "brand";
}) {
  const toneClass = {
    neutral: "bg-muted text-muted-foreground",
    positive: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    negative: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    brand: "bg-primary/10 text-primary",
  }[tone];
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", toneClass)}>
      {children}
    </span>
  );
}

export function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface h-32 animate-pulse bg-muted/40" />
      ))}
    </div>
  );
}

export function AiNotice({ children }: { children?: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border px-3 py-2 text-[11px] text-muted-foreground">
      {children ??
        "AI-generated commentary based on live prices and public headlines. Informational only — not investment advice, and never a guarantee of returns."}
    </p>
  );
}

export function DataSource({ label }: { label: string }) {
  return <p className="text-[11px] text-muted-foreground">Source: {label}</p>;
}

export function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 px-3 py-2">
      <p className="text-[10px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="num mt-0.5 text-sm font-semibold">{value}</p>
      {hint ? <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Meter({
  label,
  value,
  caption,
  tone = "brand",
}: {
  label: string;
  value: number;
  caption?: string;
  tone?: "brand" | "positive" | "negative" | "warning";
}) {
  const bar = {
    brand: "bg-primary",
    positive: "bg-emerald-500",
    negative: "bg-rose-500",
    warning: "bg-amber-500",
  }[tone];
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium">{label}</p>
        <p className="num text-sm font-semibold">{Math.round(safe)}</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", bar)}
          style={{ width: `${safe}%` }}
        />
      </div>
      {caption ? <p className="mt-1 text-[10px] text-muted-foreground">{caption}</p> : null}
    </div>
  );
}

export function formatCompact(value: number | null | undefined, currency = "INR") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : "";
  const abs = Math.abs(value);
  if (currency === "INR") {
    if (abs >= 1e12) return `${symbol}${(value / 1e12).toFixed(2)} L Cr`;
    if (abs >= 1e7) return `${symbol}${(value / 1e7).toFixed(2)} Cr`;
    if (abs >= 1e5) return `${symbol}${(value / 1e5).toFixed(2)} L`;
  }
  if (abs >= 1e9) return `${symbol}${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${symbol}${(value / 1e6).toFixed(2)}M`;
  return `${symbol}${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function formatRatio(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

export function formatPercentValue(value: number | null | undefined, alreadyPct = false) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${(alreadyPct ? value : value * 100).toFixed(2)}%`;
}

export function Bullets({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide uppercase">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-primary">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
