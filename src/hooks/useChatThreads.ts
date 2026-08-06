import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ChatThread = { id: string; title: string; updated_at: string };
export type ChatMessage = {
  id: string;
  thread_id: string;
  role: "user" | "assistant";
  content: string;
  bullets: string[];
  follow_ups: string[];
  created_at: string;
};

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

export function useChatThreads() {
  return useQuery({
    queryKey: ["chat_threads"],
    queryFn: async (): Promise<ChatThread[]> => {
      const { data, error } = await supabase
        .from("chat_threads")
        .select("id, title, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ChatThread[];
    },
  });
}

export function useChatMessages(threadId: string) {
  return useQuery({
    queryKey: ["chat_messages", threadId],
    enabled: threadId.length > 0,
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, thread_id, role, content, bullets, follow_ups, created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ChatMessage[];
    },
  });
}

export function useThreadMutations() {
  const qc = useQueryClient();
  const invalidateThreads = () => qc.invalidateQueries({ queryKey: ["chat_threads"] });

  const createThread = useMutation({
    mutationFn: async (title = "New conversation"): Promise<string> => {
      const uid = await currentUserId();
      const { data, error } = await supabase
        .from("chat_threads")
        .insert({ user_id: uid, title })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: invalidateThreads,
  });

  const renameThread = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase
        .from("chat_threads")
        .update({ title, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidateThreads,
  });

  const deleteThread = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chat_threads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidateThreads,
  });

  const appendMessage = useMutation({
    mutationFn: async (input: {
      thread_id: string;
      role: "user" | "assistant";
      content: string;
      bullets?: string[];
      follow_ups?: string[];
    }) => {
      const uid = await currentUserId();
      const { error } = await supabase.from("chat_messages").insert({
        user_id: uid,
        thread_id: input.thread_id,
        role: input.role,
        content: input.content,
        bullets: input.bullets ?? [],
        follow_ups: input.follow_ups ?? [],
      });
      if (error) throw error;
      const { error: touchError } = await supabase
        .from("chat_threads")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", input.thread_id);
      if (touchError) throw touchError;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["chat_messages", vars.thread_id] });
      invalidateThreads();
    },
  });

  return { createThread, renameThread, deleteThread, appendMessage };
}