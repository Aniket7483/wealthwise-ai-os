import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Wallet,
  Receipt,
  PieChart,
  Target,
  LineChart,
  Newspaper,
  Radar,
  Flame,
  Microscope,
  LogOut,
  Moon,
  Sun,
  Menu,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/market", label: "Market Intelligence", icon: LineChart },
  { to: "/news", label: "News Intelligence", icon: Newspaper },
  { to: "/discovery", label: "Stock Discovery", icon: Radar },
  { to: "/trending", label: "Trending Stocks", icon: Flame },
  { to: "/research", label: "AI Research Center", icon: Microscope },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/salary", label: "Salary planner", icon: Wallet },
  { to: "/expenses", label: "Expenses", icon: Receipt },
  { to: "/budget", label: "Budget", icon: PieChart },
  { to: "/goals", label: "Goals", icon: Target },
] as const;

function useTheme() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("wealth-theme");
    const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = stored ? stored === "dark" : prefers;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggle = () => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      window.localStorage.setItem("wealth-theme", next ? "dark" : "light");
      return next;
    });
  };

  return { dark, toggle };
}

export function AppShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { dark, toggle } = useTheme();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[260px_1fr]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[260px] border-r border-sidebar-border bg-sidebar transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-2 px-5">
          <span className="gradient-brand flex size-8 items-center justify-center rounded-lg text-sm font-bold text-primary-foreground">
            W
          </span>
          <div className="leading-tight">
            <p className="font-display text-sm font-semibold">AI Wealth OS</p>
            <p className="text-[11px] text-muted-foreground">Personal CFO</p>
          </div>
        </div>
        <nav className="space-y-1 px-3 py-2">
          {NAV.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute inset-x-0 bottom-0 space-y-2 p-3">
          <Button variant="ghost" className="w-full justify-start gap-3" onClick={toggle}>
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {dark ? "Light mode" : "Dark mode"}
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3" onClick={signOut}>
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {open ? (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-foreground/20 lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className="flex min-w-0 flex-col">
        <header className="surface-glass sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-none border-x-0 border-t-0 px-5 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="size-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">{title}</h1>
              {description ? (
                <p className="text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
        <main className="rise min-w-0 flex-1 space-y-6 p-5 lg:p-8">{children}</main>
      </div>
    </div>
  );
}