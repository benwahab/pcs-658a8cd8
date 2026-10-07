import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-retry-count, x-pcs-trace-id, traceparent, tracestate, baggage",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });

const normalizePhone = (v: string) => { const cleaned = v.replace(/[^0-9+]/g, "").trim(); const digits = cleaned.replace(/\D/g, ""); if (digits.length === 8) return "+227" + digits; if (digits.length === 11 && digits.startsWith("227")) return "+" + digits; return cleaned; };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Méthode non autorisée" }, 405);
    }

    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) {
      return json({ error: "Configuration du service indisponible." }, 500);
    }

    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Session requise" }, 401);

    const db = createClient(url, key);
    const { data: { user }, error: userError } = await db.auth.getUser(token);
    if (userError || !user) return json({ error: "Session invalide" }, 401);

    const { data: mairie, error: mairieError } = await db
      .from("mairies")
      .select("id,approval_status")
      .eq("account_user_id", user.id)
      .eq("is_active", true)
      .eq("approval_status", "approved")
      .maybeSingle();

    if (mairieError) {
      console.error("mairie-create-agent: mairie lookup failed", mairieError.message);
      return json({ error: "Impossible de vérifier les droits de cette mairie." }, 500);
    }
    if (!mairie) return json({ error: "Accès réservé à une mairie active" }, 403);

    let b: Record<string, unknown>;
    try {
      b = await req.json();
    } catch {
      return json({ error: "Corps de requête invalide." }, 400);
    }

    for (const k of ["first_name", "last_name", "matricule", "qualification", "password"]) {
      if (!b[k] || String(b[k]).trim() === "") {
        return json({ error: "Champs obligatoires manquants" }, 400);
      }
    }
    if (!b.phone || String(b.phone).trim() === "") {
      return json({ error: "Le numéro de téléphone est obligatoire." }, 400);
    }
    if (String(b.password).length < 8) {
      return json({ error: "Le mot de passe doit contenir au moins 8 caractères" }, 400);
    }

    const firstName = String(b.first_name).trim();
    const lastName = String(b.last_name).trim();
    const matricule = String(b.matricule).trim();
    const qualification = String(b.qualification).trim();
    const phone = normalizePhone(String(b.phone));

    if (!/^\\+227\\d{8}$/.test(phone)) {
      return json({ error: "Le numéro doit être un numéro nigérien valide à 8 chiffres." }, 400);
    }

    if (!firstName || !lastName || !matricule || !qualification || !phone) {
      return json({ error: "Vérifiez les champs obligatoires." }, 400);
    }
    if (firstName.length > 100 || lastName.length > 100 || matricule.length > 80 || qualification.length > 120 || phone.length > 30) {
      return json({ error: "Un ou plusieurs champs dépassent la longueur autorisée." }, 400);
    }

    const { data: phoneDup, error: phoneError } = await db
      .from("field_agents")
      .select("id")
      .eq("phone_normalized", phone)
      .eq("is_active", true)
      .maybeSingle();
    if (phoneError) {
      console.error("mairie-create-agent: phone check failed", phoneError.message);
      return json({ error: "Impossible de vérifier le numéro de téléphone." }, 500);
    }
    if (phoneDup) return json({ error: "Ce numéro de téléphone est déjà utilisé par un agent actif." }, 409);

    const { data: dup, error: matriculeError } = await db
      .from("field_agents")
      .select("id")
      .ilike("matricule", matricule)
      .maybeSingle();
    if (matriculeError) {
      console.error("mairie-create-agent: matricule check failed", matriculeError.message);
      return json({ error: "Impossible de vérifier le matricule." }, 500);
    }
    if (dup) return json({ error: "Ce matricule est déjà utilisé." }, 409);

    const { data: created, error: createError } = await db.auth.admin.createUser({
      email: "agent-pending-" + crypto.randomUUID() + "@agent.pcs.local",
      password: String(b.password),
      email_confirm: true,
      user_metadata: { full_name: firstName + " " + lastName, role: "agent_terrain" },
    });
    if (createError || !created.user) {
      console.error("mairie-create-agent: auth user creation failed", createError?.message);
      return json({ error: "Création du compte agent impossible." }, 400);
    }

    const uid = created.user.id;
    const rollbackUser = async () => {
      const { error } = await db.auth.admin.deleteUser(uid);
      if (error) console.error("mairie-create-agent: rollback failed", error.message);
    };

    const internalEmail = "agent-" + uid.replace(/-/g, "") + "@agent.pcs.local";
    const { error: emailError } = await db.auth.admin.updateUserById(uid, {
      email: internalEmail,
      email_confirm: true,
    });
    if (emailError) {
      await rollbackUser();
      console.error("mairie-create-agent: internal email update failed", emailError.message);
      return json({ error: "Finalisation du compte agent impossible." }, 400);
    }

    const { data: role, error: roleError } = await db
      .from("roles")
      .select("id")
      .eq("code", "agent_terrain")
      .single();
    if (roleError || !role) {
      await rollbackUser();
      console.error("mairie-create-agent: role lookup failed", roleError?.message);
      return json({ error: "Configuration du rôle agent terrain indisponible." }, 500);
    }

    const { error: profileError } = await db.from("profiles").upsert({
      id: uid,
      full_name: firstName + " " + lastName,
      phone,
    });
    if (profileError) {
      await rollbackUser();
      console.error("mairie-create-agent: profile creation failed", profileError.message);
      return json({ error: "Création du profil agent impossible." }, 400);
    }

    const { error: userRoleError } = await db.from("user_roles").insert({
      user_id: uid,
      role_id: role.id,
    });
    if (userRoleError) {
      await rollbackUser();
      console.error("mairie-create-agent: role assignment failed", userRoleError.message);
      return json({ error: "Attribution du rôle agent impossible." }, 400);
    }

    const { data: citizenRole } = await db
      .from("roles")
      .select("id")
      .eq("code", "citizen")
      .maybeSingle();
    if (citizenRole?.id) {
      const { error: citizenRoleError } = await db
        .from("user_roles")
        .delete()
        .eq("user_id", uid)
        .eq("role_id", citizenRole.id);
      if (citizenRoleError) {
        await rollbackUser();
        console.error("mairie-create-agent: inherited citizen role cleanup failed", citizenRoleError.message);
        return json({ error: "Finalisation des permissions agent impossible." }, 400);
      }
    }

    const { data: agent, error: agentError } = await db
      .from("field_agents")
      .insert({
        user_id: uid,
        mairie_id: mairie.id,
        first_name: firstName,
        last_name: lastName,
        matricule,
        qualification,
        phone,
        phone_normalized: phone,
      })
      .select("*")
      .single();

    if (agentError || !agent) {
      await rollbackUser();
      console.error("mairie-create-agent: field_agents insert failed", agentError?.message);
      return json({ error: "Enregistrement de l’agent terrain impossible." }, 400);
    }

    return json({ agent }, 201);
  } catch (e) {
    console.error("mairie-create-agent: unexpected error", e instanceof Error ? e.message : e);
    return json({ error: "Une erreur interne est survenue pendant la création de l’agent." }, 500);
  }
});