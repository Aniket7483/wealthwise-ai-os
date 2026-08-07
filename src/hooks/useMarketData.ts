import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  getFinancialNews,
  getMarketOverview,
  getQuotesFor,
  getStockBoard,
  getStockDossier,
  getSymbolDetail,
  searchSymbols,
} from "@/lib/market.functions";
import { STOCK_UNIVERSE, scoreStock, type ScoredStock } from "@/lib/market";

const FIVE_MIN = 5 * 60 * 1000;

export function useMarketOverview() {
  const fn = useServerFn(getMarketOverview);
  return useQuery({
    queryKey: ["market-overview"],
    queryFn: () => fn(),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useStockBoard() {
  const fn = useServerFn(getStockBoard);
  return useQuery({
    queryKey: ["stock-board"],
    queryFn: async () => {
      const res = await fn();
      const scored: ScoredStock[] = STOCK_UNIVERSE.flatMap((stock) => {
        const quote = res.quotes.find((q) => q.symbol === stock.symbol);
        if (!quote || !Number.isFinite(quote.price)) return [];
        return [scoreStock(stock, quote)];
      });
      return { fetchedAt: res.fetchedAt, stocks: scored };
    },
    staleTime: FIVE_MIN,
  });
}

export function useFinancialNews(topic = "") {
  const fn = useServerFn(getFinancialNews);
  return useQuery({
    queryKey: ["market-news", topic],
    queryFn: () => fn({ data: { topic } }),
    staleTime: FIVE_MIN,
  });
}

export function useSymbolDetail(symbol: string, name = "") {
  const fn = useServerFn(getSymbolDetail);
  return useQuery({
    queryKey: ["symbol-detail", symbol],
    queryFn: () => fn({ data: { symbol, name } }),
    enabled: symbol.length > 0,
    staleTime: FIVE_MIN,
  });
}

export function useSymbolSearch(query: string) {
  const fn = useServerFn(searchSymbols);
  return useQuery({
    queryKey: ["symbol-search", query],
    queryFn: () => fn({ data: { query } }),
    enabled: query.trim().length >= 2,
    staleTime: FIVE_MIN,
  });
}

export function useQuotesFor(symbols: { symbol: string; name: string }[]) {
  const fn = useServerFn(getQuotesFor);
  const key = symbols.map((s) => s.symbol).join(",");
  return useQuery({
    queryKey: ["quotes-for", key],
    queryFn: () => fn({ data: { symbols } }),
    enabled: symbols.length > 0,
    staleTime: 60_000,
  });
}

export function useStockDossier(symbol: string, name = "") {
  const fn = useServerFn(getStockDossier);
  return useQuery({
    queryKey: ["stock-dossier", symbol],
    queryFn: () => fn({ data: { symbol, name } }),
    enabled: symbol.trim().length > 0,
    staleTime: FIVE_MIN,
  });
}

/* ---------------- Watchlists & holdings ---------------- */

export type Watchlist = { id: string; name: string };
export type WatchlistItem = {
  id: string;
  watchlist_id: string;
  symbol: string;
  name: string;
  target_price: number | null;
  stop_loss: number | null;
  notes: string | null;
};
export type Holding = {
  id: string;
  symbol: string;
  name: string;
  kind: string;
  quantity: number;
  avg_price: number;
};

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

export function useWatchlists() {
  return useQuery({
    queryKey: ["watchlists"],
    queryFn: async (): Promise<Watchlist[]> => {
      const { data, error } = await supabase
        .from("watchlists")
        .select("id, name")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Watchlist[];
    },
  });
}

export function useWatchlistItems() {
  return useQuery({
    queryKey: ["watchlist_items"],
    queryFn: async (): Promise<WatchlistItem[]> => {
      const { data, error } = await supabase
        .from("watchlist_items")
        .select("id, watchlist_id, symbol, name, target_price, stop_loss, notes")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as WatchlistItem[];
    },
  });
}

export function useWatchlistMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["watchlists"] });
    qc.invalidateQueries({ queryKey: ["watchlist_items"] });
  };

  const createList = useMutation({
    mutationFn: async (name: string) => {
      const uid = await currentUserId();
      const { error } = await supabase.from("watchlists").insert({ user_id: uid, name });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const removeList = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("watchlists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const addItem = useMutation({
    mutationFn: async (input: {
      watchlist_id: string;
      symbol: string;
      name: string;
      target_price: number | null;
      stop_loss: number | null;
    }) => {
      const uid = await currentUserId();
      const { error } = await supabase.from("watchlist_items").insert({ ...input, user_id: uid });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("watchlist_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { createList, removeList, addItem, removeItem };
}

export function useHoldings() {
  return useQuery({
    queryKey: ["holdings"],
    queryFn: async (): Promise<Holding[]> => {
      const { data, error } = await supabase
        .from("holdings")
        .select("id, symbol, name, kind, quantity, avg_price")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Holding[];
    },
  });
}

export function useHoldingMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["holdings"] });

  const add = useMutation({
    mutationFn: async (input: {
      symbol: string;
      name: string;
      kind: string;
      quantity: number;
      avg_price: number;
    }) => {
      const uid = await currentUserId();
      const { error } = await supabase.from("holdings").insert({ ...input, user_id: uid });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("holdings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { add, remove };
}
