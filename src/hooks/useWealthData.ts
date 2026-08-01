import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AllocationKey } from "@/lib/finance";

export type Profile = {
  id: string;
  full_name: string | null;
  currency: string;
  risk_profile: string;
  onboarded: boolean;
};

export type IncomeSource = {
  id: string;
  label: string;
  kind: string;
  monthly_amount: number;
};

export type Expense = {
  id: string;
  category: string;
  amount: number;
  note: string | null;
  spent_on: string;
};

export type Budget = { id: string; category: string; monthly_limit: number };

export type Goal = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  priority: string;
};

export type Allocation = Record<AllocationKey, number>;

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile | null> => {
      const uid = await currentUserId();
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, currency, risk_profile, onboarded")
        .eq("id", uid)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Profile>) => {
      const uid = await currentUserId();
      const { error } = await supabase.from("profiles").update(patch).eq("id", uid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

export function useIncomeSources() {
  return useQuery({
    queryKey: ["income_sources"],
    queryFn: async (): Promise<IncomeSource[]> => {
      const { data, error } = await supabase
        .from("income_sources")
        .select("id, label, kind, monthly_amount")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as IncomeSource[];
    },
  });
}

export function useIncomeMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["income_sources"] });

  const add = useMutation({
    mutationFn: async (input: { label: string; kind: string; monthly_amount: number }) => {
      const uid = await currentUserId();
      const { error } = await supabase.from("income_sources").insert({ ...input, user_id: uid });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("income_sources").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { add, remove };
}

export function useAllocation() {
  return useQuery({
    queryKey: ["allocation"],
    queryFn: async (): Promise<Allocation | null> => {
      const uid = await currentUserId();
      const { data, error } = await supabase
        .from("allocation_plans")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as unknown as Allocation;
      const { data: created, error: insertError } = await supabase
        .from("allocation_plans")
        .insert({ user_id: uid })
        .select("*")
        .single();
      if (insertError) throw insertError;
      return created as unknown as Allocation;
    },
  });
}

export function useSaveAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Allocation>) => {
      const uid = await currentUserId();
      const { error } = await supabase
        .from("allocation_plans")
        .upsert({ user_id: uid, ...patch, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["allocation"] }),
  });
}

export function useExpenses() {
  return useQuery({
    queryKey: ["expenses"],
    queryFn: async (): Promise<Expense[]> => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, category, amount, note, spent_on")
        .order("spent_on", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Expense[];
    },
  });
}

export function useExpenseMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["expenses"] });

  const add = useMutation({
    mutationFn: async (input: {
      category: string;
      amount: number;
      note?: string;
      spent_on: string;
    }) => {
      const uid = await currentUserId();
      const { error } = await supabase.from("expenses").insert({ ...input, user_id: uid });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const addMany = useMutation({
    mutationFn: async (
      rows: { category: string; amount: number; note?: string; spent_on: string }[],
    ) => {
      const uid = await currentUserId();
      const { error } = await supabase
        .from("expenses")
        .insert(rows.map((r) => ({ ...r, user_id: uid })));
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { add, addMany, remove };
}

export function useBudgets() {
  return useQuery({
    queryKey: ["budgets"],
    queryFn: async (): Promise<Budget[]> => {
      const { data, error } = await supabase
        .from("budgets")
        .select("id, category, monthly_limit")
        .order("category");
      if (error) throw error;
      return (data ?? []) as Budget[];
    },
  });
}

export function useSaveBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { category: string; monthly_limit: number }) => {
      const uid = await currentUserId();
      const { error } = await supabase
        .from("budgets")
        .upsert({ user_id: uid, ...input }, { onConflict: "user_id,category" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgets"] }),
  });
}

export function useGoals() {
  return useQuery({
    queryKey: ["goals"],
    queryFn: async (): Promise<Goal[]> => {
      const { data, error } = await supabase
        .from("goals")
        .select("id, name, target_amount, current_amount, target_date, priority")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Goal[];
    },
  });
}

export function useGoalMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["goals"] });

  const add = useMutation({
    mutationFn: async (input: {
      name: string;
      target_amount: number;
      current_amount: number;
      target_date: string | null;
      priority: string;
    }) => {
      const uid = await currentUserId();
      const { error } = await supabase.from("goals").insert({ ...input, user_id: uid });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<Goal>) => {
      const { error } = await supabase.from("goals").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { add, update, remove };
}