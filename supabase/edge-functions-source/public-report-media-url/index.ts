import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase service configuration is missing.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const body = await req.json().catch(() => null);
    const rawPaths = Array.isArray(body?.paths) ? body.paths : [body?.path];
    const paths = [...new Set(rawPaths.filter((value: unknown): value is string =>
      typeof value === "string" && value.trim().length > 0
    ).map((value: string) => value.trim()))];

    const expiresIn =
      Number.isInteger(body?.expiresIn) && body.expiresIn >= 60 && body.expiresIn <= 3600
        ? body.expiresIn
        : 3600;

    if (!paths.length || paths.length > 20 || paths.some((path) =>
      path.startsWith("/") || path.includes("..") || path.length > 1024
    )) {
      return json({ error: "Invalid media paths." }, 400);
    }

    const { data: mediaRows, error: mediaError } = await admin
      .from("report_media")
      .select("storage_path,media_role,moderation_status,report_id")
      .in("storage_path", paths)
      .in("media_role", ["citizen_evidence", "resolution_video"])
      .eq("moderation_status", "approved");

    if (mediaError) {
      console.error("[public-report-media-url] media lookup failed", mediaError);
      return json({ error: "Unable to verify media." }, 500);
    }

    const eligible = mediaRows ?? [];
    const reportIds = [...new Set(eligible.map((media) => media.report_id))];
    const { data: reports, error: reportError } = reportIds.length
      ? await admin.from("reports").select("id,is_public,archived_at").in("id", reportIds)
      : { data: [], error: null };

    if (reportError) {
      console.error("[public-report-media-url] report lookup failed", reportError);
      return json({ error: "Unable to verify reports." }, 500);
    }

    const publicReportIds = new Set(
      (reports ?? []).filter((report) => report.is_public && !report.archived_at).map((report) => report.id),
    );
    const eligibleByPath = new Map(
      eligible.filter((media) => publicReportIds.has(media.report_id)).map((media) => [media.storage_path, media]),
    );

    const signedEntries = await Promise.all(paths.map(async (path) => {
      if (!eligibleByPath.has(path)) return [path, null] as const;
      const { data: signed, error: signError } = await admin.storage
        .from("report-media")
        .createSignedUrl(path, expiresIn);
      if (signError || !signed?.signedUrl) {
        console.error("[public-report-media-url] signed URL creation failed", signError);
        return [path, null] as const;
      }
      return [path, signed.signedUrl] as const;
    }));

    const signedUrls = Object.fromEntries(signedEntries.filter((entry) => entry[1] !== null));
    if (Array.isArray(body?.paths)) return json({ signedUrls, expiresIn });
    const signedUrl = signedUrls[paths[0]];
    if (!signedUrl) return json({ error: "Media not found, not approved, or not public." }, 404);
    return json({ signedUrl, expiresIn });
  } catch (error) {
    console.error("[public-report-media-url] unexpected error", error);
    return json({ error: "Unexpected media URL error." }, 500);
  }
});
