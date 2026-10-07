import { supabase as projectClient } from "@/integrations/supabase/client";

// PCS utilise l'unique client Supabase du projet (rqraxjypjwsxcmjdwroy) afin de
// n'avoir qu'une seule session d'authentification. Ce client est déjà typé avec
// les types générés (src/integrations/supabase/types.ts) : ne pas le re-typer
// avec un fichier de types écrit à la main.
export const supabase: typeof projectClient | null = projectClient;
// Le client du projet possède toujours l'URL et la clé officielles de PCS.
export const isSupabaseConfigured = true;
