import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-retry-count, x-pcs-trace-id, traceparent, tracestate, baggage",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(url, key);
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Session requise" }, 401);
    const {
      data: { user },
      error: ue,
    } = await db.auth.getUser(token);
    if (ue || !user) return json({ error: "Session invalide" }, 401);

    // Seule une mairie active ET approuvée peut créer des agents.
    const { data: mairie } = await db
      .from("mairies")
      .select("id")
      .eq("account_user_id", user.id)
      .eq("is_active", true)
      .eq("approval_status", "approved")
      .maybeSingle();
    if (!mairie) return json({ error: "Accès réservé à une mairie" }, 403);

    // Limitation de débit par mairie (réutilise la RPC existante, aucune migration nécessaire).
    const rateKey = await sha256("mairie-create-agent|" + mairie.id);
    const { data: allowed, error: rateError } = await db.rpc("consume_agent_login_rate_limit", {
      p_key_hash: rateKey,
      p_max_attempts: 30,
      p_window_seconds: 600,
      p_block_seconds: 600,
    });
    if (rateError)
      return json({ error: "Service temporairement indisponible. Réessayez plus tard." }, 503);
    if (allowed === false) return json({ error: "Trop de tentatives. Réessayez plus tard." }, 429);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Requête invalide" }, 400);
    }
    for (const field of ["first_name", "last_name", "matricule", "qualification", "password"]) {
      if (!body[field] || String(body[field]).trim() === "")
        return json({ error: "Champs obligatoires manquants" }, 400);
    }
    if (String(body.password).length < 8)
      return json({ error: "Le mot de passe doit contenir au moins 8 caractères" }, 400);
    const matricule = String(body.matricule).trim();
    const phone = body.phone ? String(body.phone).trim() : null;
    const phone_normalized = phone ? phone.replace(/[^0-9+]/g, "") : null;
    const { data: duplicate } = await db
      .from("field_agents")
      .select("id")
      .ilike("matricule", matricule)
      .maybeSingle();
    if (phone_normalized) {
      const { data: phoneDuplicate } = await db
        .from("field_agents")
        .select("id")
        .eq("phone_normalized", phone_normalized)
        .maybeSingle();
      if (phoneDuplicate) return json({ error: "Ce numéro de téléphone est déjà utilisé." }, 409);
    }
    if (duplicate) return json({ error: "Ce matricule est déjà utilisé." }, 409);

    const fullName = String(body.first_name).trim() + " " + String(body.last_name).trim();
    const { data: created, error: ce } = await db.auth.admin.createUser({
      email: "agent-pending-" + crypto.randomUUID() + "@agent.pcs.local",
      password: String(body.password),
      email_confirm: true,
      user_metadata: { full_name: fullName, role: "agent_terrain" },
    });
    if (ce || !created.user)
      return json({ error: ce?.message || "Création du compte impossible" }, 400);
    const uid = created.user.id;
    const rollback = async (message: string, status = 400) => {
      await db.auth.admin.deleteUser(uid);
      return json({ error: message }, status);
    };

    const internalEmail = "agent-" + uid.replace(/-/g, "") + "@agent.pcs.local";
    const { error: emailError } = await db.auth.admin.updateUserById(uid, {
      email: internalEmail,
      email_confirm: true,
    });
    if (emailError) return rollback(emailError.message);
    const { data: role, error: roleError } = await db
      .from("roles")
      .select("id")
      .eq("code", "agent_terrain")
      .single();
    if (roleError) return rollback(roleError.message);
    const { error: profileError } = await db
      .from("profiles")
      .upsert({ id: uid, full_name: fullName, phone, phone_normalized });
    if (profileError) {
      console.error("mairie-create-agent profile", profileError);
      return rollback("Création du profil de l'agent impossible.", 500);
    }
    const { error: userRoleError } = await db
      .from("user_roles")
      .insert({ user_id: uid, role_id: role.id });
    if (userRoleError) {
      console.error("mairie-create-agent role", userRoleError);
      return rollback("Attribution du rôle à l'agent impossible.", 500);
    }
    const { data: agent, error: agentError } = await db
      .from("field_agents")
      .insert({
        user_id: uid,
        mairie_id: mairie.id,
        first_name: String(body.first_name).trim(),
        last_name: String(body.last_name).trim(),
        matricule,
        qualification: String(body.qualification).trim(),
        phone: body.phone || null,
      })
      .select("*")
      .single();
    if (agentError) return rollback(agentError.message);
    return json({ agent });
  } catch (e) {
    console.error("mairie-create-agent", e);
    return json({ error: "Erreur interne" }, 500);
  }
});
