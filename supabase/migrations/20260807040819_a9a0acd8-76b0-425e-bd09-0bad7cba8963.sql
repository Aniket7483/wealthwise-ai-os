CREATE INDEX IF NOT EXISTS goals_user_idx ON public.goals (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS holdings_user_idx ON public.holdings (user_id, created_at);
CREATE INDEX IF NOT EXISTS income_sources_user_idx ON public.income_sources (user_id, created_at);
CREATE INDEX IF NOT EXISTS watchlists_user_idx ON public.watchlists (user_id, created_at);
CREATE INDEX IF NOT EXISTS watchlist_items_user_idx ON public.watchlist_items (user_id, watchlist_id);

ALTER TABLE public.expenses ADD CONSTRAINT expenses_amount_non_negative CHECK (amount >= 0) NOT VALID;
ALTER TABLE public.expenses VALIDATE CONSTRAINT expenses_amount_non_negative;

ALTER TABLE public.income_sources ADD CONSTRAINT income_sources_amount_non_negative CHECK (monthly_amount >= 0) NOT VALID;
ALTER TABLE public.income_sources VALIDATE CONSTRAINT income_sources_amount_non_negative;

ALTER TABLE public.budgets ADD CONSTRAINT budgets_limit_non_negative CHECK (monthly_limit >= 0) NOT VALID;
ALTER TABLE public.budgets VALIDATE CONSTRAINT budgets_limit_non_negative;

ALTER TABLE public.goals ADD CONSTRAINT goals_amounts_non_negative CHECK (target_amount >= 0 AND current_amount >= 0) NOT VALID;
ALTER TABLE public.goals VALIDATE CONSTRAINT goals_amounts_non_negative;

ALTER TABLE public.holdings ADD CONSTRAINT holdings_values_non_negative CHECK (quantity >= 0 AND avg_price >= 0) NOT VALID;
ALTER TABLE public.holdings VALIDATE CONSTRAINT holdings_values_non_negative;

ALTER TABLE public.allocation_plans ADD CONSTRAINT allocation_plans_pct_range CHECK (
  savings_pct BETWEEN 0 AND 100 AND
  investments_pct BETWEEN 0 AND 100 AND
  emergency_pct BETWEEN 0 AND 100 AND
  tax_pct BETWEEN 0 AND 100 AND
  personal_pct BETWEEN 0 AND 100 AND
  family_pct BETWEEN 0 AND 100 AND
  emi_pct BETWEEN 0 AND 100 AND
  insurance_pct BETWEEN 0 AND 100
) NOT VALID;
ALTER TABLE public.allocation_plans VALIDATE CONSTRAINT allocation_plans_pct_range;