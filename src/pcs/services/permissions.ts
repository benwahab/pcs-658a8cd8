import { supabase } from "../lib/supabase";

export type AppRole = "citizen" | "agent" | "moderator" | "admin" | "mairie" | "agent_terrain";
export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}
export async function getMyRoles(): Promise<AppRole[]> {
  const session = await getSession();
  if (!session) return [];
  const { data, error } = await supabase!
    .from("user_roles")
    .select("roles(code)")
    .eq("user_id", session.user.id);
  if (error) throw error;
  return (data ?? []).map((row: any) => row.roles?.code).filter(Boolean) as AppRole[];
}
export function canOperate(roles: AppRole[]) {
  return roles.some((r) => r === "agent" || r === "admin" || r === "mairie");
}
export function canAdmin(roles: AppRole[]) {
  return roles.includes("admin");
}
