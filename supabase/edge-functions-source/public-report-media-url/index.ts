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
    const path = typeof body?.path === "string" ? body.path.trim() : "";
    const expiresIn =
      Number.isInteger(body?.expiresIn) && body.expiresIn >= 60 && body.expiresIn <= 3600
        ? body.expiresIn
        : 3600;

    if (!path || path.startsWith("/") || path.includes("..") || path.length > 1024) {
      return json({ error: "Invalid media path." }, 400);
    }

    const { data: media, error: mediaError } = await admin
      .from("report_media")
      .select("storage_path,media_role,moderation_status,report_id")
      .eq("storage_path", path)
      .in("media_role", ["citizen_evidence", "resolution_video"])
      .eq("moderation_status", "approved")
      .maybeSingle();

    if (mediaError) {
      console.error("[public-report-media-url] media lookup failed", mediaError);
      return json({ error: "Unable to verify media." }, 500);
    }

    if (!media) return json({ error: "Media not found or not approved." }, 404);

    const { data: report, error: reportError } = await admin
      .from("reports")
      .select("id,is_public")
      .eq("id", media.report_id)
      .maybeSingle();

    if (reportError) {
      console.error("[public-report-media-url] report lookup failed", reportError);
      return json({ error: "Unable to verify report." }, 500);
    }

    if (!report?.is_public) return json({ error: "Media is not public." }, 403);

    const { data: signed, error: signError } = await admin.storage
      .from("report-media")
      .createSignedUrl(path, expiresIn);

    if (signError || !signed?.signedUrl) {
      console.error("[public-report-media-url] signed URL creation failed", signError);
      return json({ error: "Unable to create media URL." }, 502);
    }

    return json({ signedUrl: signed.signedUrl, expiresIn });
  } catch (error) {
    console.error("[public-report-media-url] unexpected error", error);
    return json({ error: "Unexpected media URL error." }, 500);
  }
});
