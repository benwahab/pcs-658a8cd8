import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceKey || !anonKey) return json({ error: "Configuration serveur incomplète." }, 500);
  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "Authentification CST requise." }, 401);
  const auth = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user }, error: authError } = await auth.auth.getUser();
  if (authError || !user) return json({ error: "Session invalide." }, 401);
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: cst, error: cstError } = await admin.from("cst_accounts").select("id").eq("user_id", user.id).maybeSingle();
  if (cstError) return json({ error: "Vérification CST indisponible." }, 500);
  if (!cst) return json({ error: "Accès réservé au CST." }, 403);

  try {
    const body = await req.json();
    if (body?.action === "list") {
      const { data, error } = await admin.from("reports")
        .select("id,reference_code,title,status,priority,location_label,created_at,archived_at,is_public,report_media(id,media_type,media_role,moderation_status,file_size,created_at)")
        .order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return json({ items: data ?? [] });
    }
    const reportId = typeof body?.report_id === "string" ? body.report_id : "";
    if (!uuid.test(reportId)) return json({ error: "Référence de signalement invalide." }, 400);
    if (body.action === "archive" || body.action === "restore") {
      const archivedAt = body.action === "archive" ? new Date().toISOString() : null;
      const { data, error } = await admin.from("reports").update({ archived_at: archivedAt })
        .eq("id", reportId).select("id,archived_at").maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Signalement introuvable." }, 404);
      return json({ success: true, report: data });
    }
    if (body.action === "delete") {
      const { data: report, error: reportError } = await admin.from("reports")
        .select("id,report_media(id,storage_path)").eq("id", reportId).maybeSingle();
      if (reportError) throw reportError;
      if (!report) return json({ error: "Signalement introuvable." }, 404);
      const paths = [...new Set((report.report_media ?? []).map((m: any) => m.storage_path).filter((p: unknown): p is string => typeof p === "string" && p.length > 0))];
      for (let i = 0; i < paths.length; i += 100) {
        const { error } = await admin.storage.from("report-media").remove(paths.slice(i, i + 100));
        if (error) return json({ error: "Les fichiers du signalement n’ont pas tous pu être supprimés. Le signalement est conservé ; vous pouvez réessayer." }, 502);
      }
      const { data: removed, error: deleteError } = await admin.from("reports").delete().eq("id", reportId).select("id");
      if (deleteError) return json({ error: "Les fichiers ont été retirés mais la suppression du signalement a échoué. Réessayez cette opération." }, 500);
      if (!removed?.length) return json({ error: "Le signalement n’a pas été supprimé." }, 500);
      return json({ success: true, deleted_media_count: paths.length });
    }
    return json({ error: "Action non reconnue." }, 400);
  } catch (error) {
    console.error("[cst-report-management]", error);
    return json({ error: "Opération impossible pour le moment." }, 500);
  }
});