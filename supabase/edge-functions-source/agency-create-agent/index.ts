import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Session requise" }, 401);

    const {
      data: { user },
      error: userError,
    } = await db.auth.getUser(token);
    if (userError || !user) return json({ error: "Session invalide" }, 401);

    const { data: membership, error: membershipError } = await db
      .from("organization_users")
      .select("organization_id,unit_id,role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .in("role", ["admin", "supervisor"])
      .not("unit_id", "is", null)
      .maybeSingle();
    if (membershipError) return json({ error: membershipError.message }, 500);
    if (!membership?.organization_id || !membership.unit_id)
      return json({ error: "Accès centrale requis" }, 403);

    const { data: central, error: centralError } = await db
      .from("organization_units")
      .select("id,organization_id,unit_type,is_active")
      .eq("id", membership.unit_id)
      .eq("organization_id", membership.organization_id)
      .eq("unit_type", "central")
      .eq("is_active", true)
      .maybeSingle();
    if (centralError) return json({ error: centralError.message }, 500);
    if (!central) return json({ error: "Seule la centrale peut créer les comptes agents terrain." }, 403);

    const body = await req.json();
    for (const field of ["first_name", "last_name", "matricule", "qualification", "password"]) {
      if (!body[field] || String(body[field]).trim() === "")
        return json({ error: "Champs obligatoires manquants" }, 400);
    }
    if (!body.organization_unit_id)
      return json({ error: "Choisissez l'agence de rattachement de l'agent." }, 400);
    if (String(body.password).length < 8)
      return json({ error: "Le mot de passe doit contenir au moins 8 caractères" }, 400);

    const { data: agency, error: agencyError } = await db
      .from("organization_units")
      .select("id")
      .eq("id", String(body.organization_unit_id))
      .eq("organization_id", membership.organization_id)
      .eq("parent_unit_id", central.id)
      .eq("unit_type", "agency")
      .eq("is_active", true)
      .maybeSingle();
    if (agencyError) return json({ error: agencyError.message }, 500);
    if (!agency) return json({ error: "L'agence sélectionnée n'appartient pas à cette centrale ou n'est pas active." }, 403);

    const matricule = String(body.matricule).trim();
    const phone = body.phone ? String(body.phone).trim() : null;
    const phoneNormalized = phone ? phone.replace(/[^0-9+]/g, "") : null;

    const { data: duplicateMatricule, error: duplicateMatriculeError } = await db
      .from("field_agents")
      .select("id")
      .eq("organization_id", membership.organization_id)
      .ilike("matricule", matricule)
      .maybeSingle();
    if (duplicateMatriculeError) return json({ error: duplicateMatriculeError.message }, 500);
    if (duplicateMatricule)
      return json({ error: "Ce matricule est déjà utilisé dans cette organisation." }, 409);

    if (phoneNormalized) {
      const { data: duplicatePhone, error: duplicatePhoneError } = await db
        .from("field_agents")
        .select("id")
        .eq("phone_normalized", phoneNormalized)
        .maybeSingle();
      if (duplicatePhoneError) return json({ error: duplicatePhoneError.message }, 500);
      if (duplicatePhone) return json({ error: "Ce numéro de téléphone est déjà utilisé." }, 409);
    }

    const { data: role, error: roleError } = await db
      .from("roles")
      .select("id")
      .eq("code", "agent_terrain")
      .single();
    if (roleError) return json({ error: roleError.message }, 500);

    const fullName = String(body.first_name).trim() + " " + String(body.last_name).trim();
    const internalEmail = "agent-" + crypto.randomUUID().replace(/-/g, "") + "@agent.pcs.local";
    const { data: created, error: createError } = await db.auth.admin.createUser({
      email: internalEmail,
      password: String(body.password),
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: "agent_terrain",
        organization_id: membership.organization_id,
        organization_unit_id: agency.id,
      },
    });
    if (createError || !created.user)
      return json({ error: createError?.message || "Création du compte impossible" }, 400);

    const agentUserId = created.user.id;
    try {
      const { error: profileError } = await db
        .from("profiles")
        .upsert({ id: agentUserId, full_name: fullName, phone, phone_normalized: phoneNormalized });
      if (profileError) throw profileError;

      const { error: userRoleError } = await db
        .from("user_roles")
        .insert({ user_id: agentUserId, role_id: role.id });
      if (userRoleError) throw userRoleError;

      const { data: agent, error: agentError } = await db
        .from("field_agents")
        .insert({
          user_id: agentUserId,
          mairie_id: null,
          organization_id: membership.organization_id,
          organization_unit_id: agency.id,
          first_name: String(body.first_name).trim(),
          last_name: String(body.last_name).trim(),
          matricule,
          qualification: String(body.qualification).trim(),
          phone,
          phone_normalized: phoneNormalized,
          is_active: true,
        })
        .select("id,first_name,last_name,matricule,qualification,phone,is_active,organization_id,organization_unit_id")
        .single();
      if (agentError) throw agentError;
      return json({ agent });
    } catch (error) {
      await db.auth.admin.deleteUser(agentUserId);
      return json(
        { error: error instanceof Error ? error.message : "Création de l'agent impossible" },
        400,
      );
    }
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Erreur interne" }, 500);
  }
});
