import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  const url = Deno.env.get("SUPABASE_URL"),
    serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceKey || !anonKey)
    return json({ error: "Configuration serveur incomplète." }, 500);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Authentification CST requise." }, 401);
  const auth = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: authError,
  } = await auth.auth.getUser();
  if (authError || !user) return json({ error: "Session invalide." }, 401);
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: account } = await admin
    .from("cst_accounts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!account) return json({ error: "Accès réservé au CST." }, 403);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "list");
  if (action === "list") {
    const { data, error } = await admin
      .from("cst_video_archives")
      .select(
        "id,media_id,report_id,archived_at,expires_at,hold_reason,deleted_at,report_media!inner(id,storage_path,media_type,file_size,created_at),reports!inner(id,reference_code,title,location_label,status,created_at,region_id)",
      )
      .is("deleted_at", null)
      .or("expires_at.gt." + new Date().toISOString() + ",hold_reason.not.is.null")
      .order("archived_at", { ascending: false })
      .limit(200);
    if (error) return json({ error: "Impossible de charger les archives vidéo." }, 500);
    const items = [];
    for (const row of data ?? []) {
      const media = (row as any).report_media;
      if (!media?.storage_path) continue;
      const { data: signed, error: signedError } = await admin.storage
        .from("report-media")
        .createSignedUrl(media.storage_path, 900);
      items.push({
        ...row,
        media_type: media.media_type,
        file_size: media.file_size,
        media_created_at: media.created_at,
        preview_url: signedError ? null : (signed?.signedUrl ?? null),
        report: (row as any).reports,
        report_media: undefined,
        reports: undefined,
      });
    }
    return json({ items, scope: "cst-only", signed_url_ttl_seconds: 900 });
  }
  if (action === "hold" || action === "release") {
    const archiveId = String(body.archive_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(archiveId))
      return json({ error: "Référence d'archive invalide." }, 400);
    const reason = String(body.reason ?? "")
      .trim()
      .slice(0, 500);
    if (action === "hold" && !reason)
      return json({ error: "Une justification est obligatoire." }, 400);
    const { data, error } = await admin
      .from("cst_video_archives")
      .update({ hold_reason: action === "hold" ? reason : null })
      .eq("id", archiveId)
      .is("deleted_at", null)
      .select("id,hold_reason,expires_at")
      .maybeSingle();
    if (error) return json({ error: "Impossible de modifier la conservation." }, 500);
    if (!data) return json({ error: "Archive introuvable ou déjà supprimée." }, 404);
    return json({ archive: data });
  }
  if (action === "cleanup") {
    const dryRun = body.dry_run !== false;
    const limit = Math.max(1, Math.min(Number(body.limit) || 50, 100));
    const { data: expired, error } = await admin
      .from("cst_video_archives")
      .select("id,media_id,report_id,expires_at,hold_reason,report_media!inner(storage_path)")
      .is("deleted_at", null)
      .lt("expires_at", new Date().toISOString())
      .is("hold_reason", null)
      .order("expires_at", { ascending: true })
      .limit(limit);
    if (error) return json({ error: "Impossible de sélectionner les archives échues." }, 500);
    if (dryRun)
      return json({
        dry_run: true,
        candidates: (expired ?? []).map((x: any) => ({ id: x.id, expires_at: x.expires_at })),
        count: expired?.length ?? 0,
      });
    const results = [];
    for (const row of expired ?? []) {
      const path = (row as any).report_media?.storage_path;
      if (!path) {
        results.push({ id: row.id, outcome: "failed" });
        continue;
      }
      const { error: removeError } = await admin.storage.from("report-media").remove([path]);
      if (removeError) {
        await admin
          .from("cst_archive_cleanup_log")
          .insert({
            archive_id: row.id,
            media_id: row.media_id,
            report_id: row.report_id,
            storage_path: path,
            outcome: "failed",
            details: String(removeError.message ?? removeError).slice(0, 1000),
          });
        results.push({ id: row.id, outcome: "failed" });
        continue;
      }
      const { error: markError } = await admin
        .from("cst_video_archives")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", row.id)
        .is("deleted_at", null);
      await admin
        .from("cst_archive_cleanup_log")
        .insert({
          archive_id: row.id,
          media_id: row.media_id,
          report_id: row.report_id,
          storage_path: path,
          outcome: markError ? "deleted" : "deleted",
          details: markError
            ? "Objet supprimé; marquage à réconcilier: " + String(markError.message).slice(0, 900)
            : null,
        });
      results.push({ id: row.id, outcome: markError ? "deleted_needs_reconciliation" : "deleted" });
    }
    return json({ dry_run: false, processed: results.length, results });
  }
  return json({ error: "Action inconnue." }, 400);
});
