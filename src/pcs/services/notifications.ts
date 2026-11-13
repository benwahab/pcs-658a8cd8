import { supabase } from "../lib/supabase";

export async function listMyNotifications(userId: string) {
  if (!supabase) throw new Error("Supabase n’est pas configuré.");
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export async function markNotificationRead(id: string) {
  if (!supabase) throw new Error("Supabase n’est pas configuré.");
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
