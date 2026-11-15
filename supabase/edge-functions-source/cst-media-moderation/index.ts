import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-pcs-trace-id, traceparent",
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
  const url = Deno.env.get("SUPABASE_URL")!,
    serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Authentification requise." }, 401);
  const authClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();
  if (userError || !user) return json({ error: "Session invalide." }, 401);
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: cst } = await admin
    .from("cst_accounts")
    .select("id,user_id,email")
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: moderator } = await admin
    .from("moderator_profiles")
    .select("user_id,email,full_name,region_id,is_active,regions(id,name,code)")
    .eq("user_id", user.id)
    .maybeSingle();
  const isCst = !!cst;
  const isModerator = !!moderator && moderator.is_active === true;
  if (!isCst && !isModerator) return json({ error: "Accès de modération refusé." }, 403);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "list");
  const moderatorRegionId = isModerator ? moderator.region_id : null;
  if (action === "list") {
    let queue = admin
      .from("report_media")
      .select(
        "id,report_id,storage_path,media_type,media_role,file_size,created_at,captured_latitude,captured_longitude,uploaded_by,moderation_status,reports!inner(id,reference_code,title,status,priority,location_label,created_at,is_public,region_id)",
      )
      .eq("media_role", "citizen_evidence")
      .or("media_type.like.video/%,media_type.like.image/%")
      .eq("moderation_status", "pending")
      .order("created_at", { ascending: false });

    if (isModerator) {
      queue = queue.eq("reports.region_id", moderatorRegionId);
    } else if (isCst) {
      const { data: covered, error: coveredError } = await admin
        .from("moderator_profiles")
        .select("region_id")
        .eq("is_active", true);
      if (coveredError)
        return json(
          { error: "Impossible de déterminer le routage régional de la modération." },
          500,
        );
      const coveredRegionIds = [
        ...new Set((covered ?? []).map((row) => row.region_id).filter(Boolean)),
      ];
      if (coveredRegionIds.length) {
        queue = queue.not("reports.region_id", "in", "(" + coveredRegionIds.join(",") + ")");
      }
    }

    const { data, error } = await queue.limit(100);
    if (error) return json({ error: "Impossible de charger la file de modération." }, 500);
    const filtered = data ?? [];
    const items = [];
    const nearbyByReport = new Map<string, unknown[]>();
    for (const media of filtered) {
      const report = media.reports ?? null;
      let nearbyReports: unknown[] = [];
      if (report?.id) {
        if (!nearbyByReport.has(report.id)) {
          const { data: nearby, error: nearbyError } = await admin.rpc(
            "find_nearby_reports_for_moderation",
            { p_report_id: report.id },
          );
          if (nearbyError) {
            console.error("cst-media-moderation nearby report check", nearbyError);
          }
          nearbyByReport.set(report.id, nearbyError ? [] : (nearby ?? []));
        }
        nearbyReports = nearbyByReport.get(report.id) ?? [];
      }
      const { data: signed } = await admin.storage
        .from("report-media")
        .createSignedUrl(media.storage_path, 900);
      items.push({
        ...media,
        reports: undefined,
        report,
        nearby_reports: nearbyReports,
        preview_url: signed?.signedUrl ?? null,
      });
    }
    return json({
      items,
      region: isModerator ? (moderator.regions ?? null) : null,
      scope: isCst ? "cst-fallback" : "regional",
    });
  }
  const mediaId = String(body.media_id ?? "").trim();
  if (!mediaId) return json({ error: "Média requis." }, 400);
  const { data: media, error: mediaError } = await admin
    .from("report_media")
    .select("id,report_id,storage_path,media_role,media_type,moderation_status")
    .eq("id", mediaId)
    .maybeSingle();
  const mediaType = String(media?.media_type ?? "");
  if (
    mediaError ||
    !media ||
    media.media_role !== "citizen_evidence" ||
    !(mediaType.startsWith("video/") || mediaType.startsWith("image/"))
  )
    return json({ error: "Média de signalement introuvable." }, 404);
  if (media.moderation_status !== "pending")
    return json({ error: "Ce média a déjà été traité." }, 409);
  if (isModerator) {
    const { data: report } = await admin
      .from("reports")
      .select("region_id")
      .eq("id", media.report_id)
      .maybeSingle();
    if (!report || report.region_id !== moderatorRegionId)
      return json({ error: "Ce média n’appartient pas à votre région." }, 403);
  }
  if (action === "approve" || action === "reject") {
    const reason = action === "reject" ? String(body.reason ?? "").trim() : null;
    if (action === "reject" && reason!.length < 5)
      return json({ error: "Un motif de rejet d’au moins 5 caractères est requis." }, 400);
    const { data: decision, error: decisionError } = await admin.rpc("apply_cst_media_moderation", {
      p_media_id: mediaId,
      p_moderator_id: user.id,
      p_action: action === "approve" ? "approved" : "rejected",
      p_reason: reason,
    });
    if (decisionError) {
      const code = decisionError.code;
      if (code === "P0003") return json({ error: "Ce média a déjà été traité." }, 409);
      if (code === "P0002") return json({ error: "Média de signalement introuvable." }, 404);
      if (code === "42501")
        return json(
          { error: "Cette vidéo n’appartient pas à votre périmètre de modération." },
          403,
        );
      if (code === "22023") return json({ error: "Action de modération invalide." }, 400);
      return json(
        { error: action === "approve" ? "Approbation impossible." : "Rejet impossible." },
        500,
      );
    }
    const storagePath = decision?.[0]?.storage_path ?? media.storage_path;
    if (action === "reject") {
      const { error: storageError } = await admin.storage
        .from("report-media")
        .remove([storagePath]);
      if (storageError)
        return json({
          success: true,
          status: "rejected",
          storage_deleted: false,
          audit_logged: true,
          warning:
            "Vidéo rejetée et décision journalisée, mais la suppression du fichier de stockage doit être vérifiée.",
        });
      return json({ success: true, status: "rejected", storage_deleted: true, audit_logged: true });
    }
    return json({ success: true, status: "approved", audit_logged: true });
  }
  return json({ error: "Action de modération inconnue." }, 400);
});
