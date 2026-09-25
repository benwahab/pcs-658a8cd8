import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405 });
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(url, key);
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "Session requise" }), { status: 401 });
    const { data: { user }, error: ue } = await db.auth.getUser(token);
    if (ue || !user) return new Response(JSON.stringify({ error: "Session invalide" }), { status: 401 });
    const { data: mairie } = await db.from("mairies").select("id").eq("account_user_id", user.id).eq("is_active", true).maybeSingle();
    if (!mairie) return new Response(JSON.stringify({ error: "Accès réservé à une mairie" }), { status: 403 });
    const body = await req.json();
    for (const field of ["first_name", "last_name", "matricule", "qualification", "password"]) {
      if (!body[field] || String(body[field]).trim() === "") return new Response(JSON.stringify({ error: "Champs obligatoires manquants" }), { status: 400 });
    }
    if (String(body.password).length < 8) return new Response(JSON.stringify({ error: "Le mot de passe doit contenir au moins 8 caractères" }), { status: 400 });
    const matricule = String(body.matricule).trim();
    const phone = body.phone ? String(body.phone).trim() : null;
    const phone_normalized = phone ? phone.replace(/[^0-9+]/g, "") : null;
    const { data: duplicate } = await db.from("field_agents").select("id").ilike("matricule", matricule).maybeSingle();
    if (phone_normalized) {
      const { data: phoneDuplicate } = await db.from("field_agents").select("id").eq("phone_normalized", phone_normalized).maybeSingle();
      if (phoneDuplicate) return new Response(JSON.stringify({ error: "Ce numéro de téléphone est déjà utilisé." }), { status: 409 });
    }
    if (duplicate) return new Response(JSON.stringify({ error: "Ce matricule est déjà utilisé." }), { status: 409 });
    const { data: created, error: ce } = await db.auth.admin.createUser({
      email: "agent-pending-" + crypto.randomUUID() + "@agent.pcs.local",
      password: String(body.password),
      email_confirm: true,
      user_metadata: { full_name: String(body.first_name) + " " + String(body.last_name), role: "agent_terrain" }
    });
    if (ce || !created.user) return new Response(JSON.stringify({ error: ce?.message || "Création du compte impossible" }), { status: 400 });
    const uid = created.user.id;
    const internalEmail = "agent-" + uid.replace(/-/g, "") + "@agent.pcs.local";
    const { error: emailError } = await db.auth.admin.updateUserById(uid, { email: internalEmail, email_confirm: true });
    if (emailError) { await db.auth.admin.deleteUser(uid); return new Response(JSON.stringify({ error: emailError.message }), { status: 400 }); }
    const { data: role, error: roleError } = await db.from("roles").select("id").eq("code", "agent_terrain").single();
    if (roleError) { await db.auth.admin.deleteUser(uid); return new Response(JSON.stringify({ error: roleError.message }), { status: 400 }); }
    await db.from("profiles").upsert({ id: uid, full_name: String(body.first_name) + " " + String(body.last_name), phone, phone_normalized });
    await db.from("user_roles").insert({ user_id: uid, role_id: role.id });
    const { data: agent, error: agentError } = await db.from("field_agents").insert({
      user_id: uid, mairie_id: mairie.id, first_name: String(body.first_name).trim(), last_name: String(body.last_name).trim(),
      matricule, qualification: String(body.qualification).trim(), phone: body.phone || null
    }).select("*").single();
    if (agentError) { await db.auth.admin.deleteUser(uid); return new Response(JSON.stringify({ error: agentError.message }), { status: 400 }); }
    return new Response(JSON.stringify({ agent }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur interne" }), { status: 500, headers: { "content-type": "application/json" } });
  }
});