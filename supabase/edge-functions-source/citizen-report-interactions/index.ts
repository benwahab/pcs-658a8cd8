import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

async function hashRateKey(value: string, pepper: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${pepper}|${value}`),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function consumeRateLimit(
  admin: ReturnType<typeof createClient>,
  pepper: string,
  key: string,
  maxEvents: number,
  windowSeconds: number,
): Promise<boolean> {
  const p_key_hash = await hashRateKey(key, pepper);
  const { data, error } = await admin.rpc("consume_citizen_report_rate_limit", {
    p_key_hash,
    p_max_events: maxEvents,
    p_window_seconds: windowSeconds,
  });
  if (error || typeof data !== "boolean") {
    console.error(
      "citizen-report-interactions rate limiter unavailable",
      error?.message ?? "invalid result",
    );
    throw new Error("Rate limiter unavailable");
  }
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey)
    return json({ error: "Service temporairement indisponible." }, 503);

  // Supabase's API gateway is Cloudflare-backed. Do not trust a caller-supplied
  // X-Forwarded-For value for security decisions; use the gateway IP header only.
  const clientIp = req.headers.get("cf-connecting-ip")?.trim() ?? "";
  if (!clientIp || clientIp.length > 64 || !/^[0-9a-fA-F:.]+$/.test(clientIp)) {
    return json({ error: "Impossible de vérifier la connexion. Réessayez." }, 503);
  }

  let payload: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return json({ error: "Requête invalide." }, 400);
    }
    payload = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "Requête invalide." }, 400);
  }

  const action = payload.action;
  const reportId = payload.report_id;
  if (!isUuid(reportId)) return json({ error: "Signalement invalide." }, 400);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    if (action === "comment") {
      const visitorToken = payload.visitor_token;
      const body = typeof payload.body === "string" ? payload.body.trim() : "";
      const displayName =
        payload.display_name === null || payload.display_name === undefined
          ? null
          : typeof payload.display_name === "string"
            ? payload.display_name.trim()
            : "";
      if (!isUuid(visitorToken)) return json({ error: "Identifiant citoyen invalide." }, 400);
      if (body.length < 2 || body.length > 1000) {
        return json({ error: "Le commentaire doit contenir entre 2 et 1 000 caractères." }, 400);
      }
      if (displayName !== null && (displayName.length < 1 || displayName.length > 60)) {
        return json({ error: "Nom affiché invalide." }, 400);
      }

      // 20 comments/hour per IP, in addition to the existing 5/hour browser-token limit.
      const allowed = await consumeRateLimit(
        admin,
        serviceKey,
        `citizen-comment|${clientIp}`,
        20,
        3600,
      );
      if (!allowed)
        return json(
          { error: "Trop de commentaires depuis cette connexion. Réessayez plus tard." },
          429,
        );

      const { data, error } = await admin.rpc("submit_public_report_comment", {
        p_report_id: reportId,
        p_body: body,
        p_display_name: displayName,
        p_visitor_token: visitorToken,
      });
      if (error) {
        if (error.code === "P0001")
          return json(
            { error: "La limite de commentaires est atteinte. Réessayez plus tard." },
            429,
          );
        if (error.code === "P0002") return json({ error: "Signalement public introuvable." }, 404);
        if (error.code === "22023") return json({ error: "Commentaire invalide." }, 400);
        console.error("citizen-report-interactions comment RPC", error);
        return json({ error: "Impossible de publier le commentaire." }, 500);
      }
      return json({ success: true, comment_id: data });
    }

    if (action === "confirmation") {
      const visitorToken = payload.visitor_token;
      if (!isUuid(visitorToken)) return json({ error: "Identifiant citoyen invalide." }, 400);

      // Global and per-report limits stop token rotation and rapid counter manipulation.
      const globalAllowed = await consumeRateLimit(
        admin,
        serviceKey,
        `citizen-confirmation|${clientIp}`,
        120,
        3600,
      );
      if (!globalAllowed)
        return json(
          { error: "Trop de confirmations depuis cette connexion. Réessayez plus tard." },
          429,
        );
      const reportAllowed = await consumeRateLimit(
        admin,
        serviceKey,
        `citizen-confirmation|${clientIp}|${reportId}`,
        10,
        3600,
      );
      if (!reportAllowed)
        return json({ error: "Trop de changements sur ce signalement. Réessayez plus tard." }, 429);

      const { data, error } = await admin.rpc("toggle_public_report_confirmation", {
        p_report_id: reportId,
        p_visitor_token: visitorToken,
      });
      if (error) {
        if (error.code === "P0002") return json({ error: "Signalement public introuvable." }, 404);
        if (error.code === "22023") return json({ error: "Identifiant citoyen invalide." }, 400);
        console.error("citizen-report-interactions confirmation RPC", error);
        return json({ error: "Impossible d'enregistrer la confirmation." }, 500);
      }
      return json(data);
    }

    return json({ error: "Action non autorisée." }, 400);
  } catch (error) {
    console.error("citizen-report-interactions", error);
    return json({ error: "Service temporairement indisponible. Réessayez." }, 503);
  }
});
