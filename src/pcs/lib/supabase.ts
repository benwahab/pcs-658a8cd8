import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase as projectClient } from "@/integrations/supabase/client";
import type { Database } from "../types/database";

// PCS uses the single project Supabase client (rqraxjypjwsxcmjdwroy) so there is
// only one auth session in the app. Typed with the PCS database types.
export const supabase: SupabaseClient<Database> | null =
  projectClient as unknown as SupabaseClient<Database>;
export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
