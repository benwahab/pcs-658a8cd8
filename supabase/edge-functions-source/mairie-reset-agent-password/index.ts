import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRoleKey)
      return json({ error: "Configuration du service indisponible." }, 500);

    const token = req.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim();
    if (!token) return json({ error: "Session requise." }, 401);

    const admin = createClient(url, serviceRoleKey);
    const {
      data: { user },
      error: authError,
    } = await admin.auth.getUser(token);
    if (authError || !user) return json({ error: "Session invalide." }, 401);

    const { data: mairie, error: mairieError } = await admin
      .from("mairies")
      .select("id")
      .eq("account_user_id", user.id)
      .eq("is_active", true)
      .eq("approval_status", "approved")
      .maybeSingle();
    if (mairieError) {
      console.error("mairie-reset-agent-password: mairie lookup failed", mairieError.message);
      return json({ error: "Impossible de vérifier les droits de cette mairie." }, 500);
    }
    if (!mairie) return json({ error: "Accès réservé à une mairie active et approuvée." }, 403);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Corps de requête invalide." }, 400);
    }

    const agentId = typeof body.agent_id === "string" ? body.agent_id.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!agentId || !password)
      return json({ error: "Agent et nouveau mot de passe obligatoires." }, 400);
    if (password.length < 8 || password.length > 128) {
      return json({ error: "Le mot de passe doit contenir entre 8 et 128 caractères." }, 400);
    }

    const { data: agent, error: agentError } = await admin
      .from("field_agents")
      .select("id,user_id,mairie_id")
      .eq("id", agentId)
      .eq("mairie_id", mairie.id)
      .maybeSingle();
    if (agentError) {
      console.error("mairie-reset-agent-password: agent lookup failed", agentError.message);
      return json({ error: "Impossible de vérifier cet agent." }, 500);
    }
    if (!agent) return json({ error: "Cet agent n'appartient pas à votre mairie." }, 404);

    const { error: updateError } = await admin.auth.admin.updateUserById(agent.user_id, {
      password,
    });
    if (updateError) {
      console.error("mairie-reset-agent-password: password update failed", updateError.message);
      return json({ error: "La réinitialisation du mot de passe a échoué." }, 500);
    }

    return json({ success: true });
  } catch (error) {
    console.error(
      "mairie-reset-agent-password: unexpected error",
      error instanceof Error ? error.message : error,
    );
    return json({ error: "Une erreur interne est survenue." }, 500);
  }
});
