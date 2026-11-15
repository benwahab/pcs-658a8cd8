import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-pcs-trace-id, traceparent",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
// Rows as returned at runtime by the two queries of `list_professional_accounts`
// (supabase-js cannot infer to-one embeds without generated types, hence the explicit shapes).
type MairieAccountRow = {
  id: string;
  name: string;
  account_user_id: string;
  is_active: boolean;
  approval_status: string;
  phone: string | null;
  communes: { name: string } | null;
  regions: { name: string } | null;
};
type OrganizationAccountRow = {
  id: string;
  user_id: string;
  is_active: boolean;
  organizations: { id: string; name: string; code: string };
  organization_units: { id: string; name: string; unit_type: string } | null;
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
async function hash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = Deno.env.get("SUPABASE_URL")!,
    serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  if (req.method === "GET") {
    const { count, error } = await admin
      .from("cst_accounts")
      .select("id", { count: "exact", head: true });
    if (error) return json({ error: "État CST indisponible." }, 500);
    return json({ configured: (count ?? 0) > 0 });
  }
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  const authHeader = req.headers.get("Authorization");
  async function requireCst() {
    if (!authHeader) return null;
    const authClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) return null;
    const { data: account } = await admin
      .from("cst_accounts")
      .select("id,user_id,email")
      .eq("user_id", user.id)
      .maybeSingle();
    return account ? user : null;
  }
  const body = await req.json().catch(() => ({}));
  const action = body.action;

  if (
    action === "list_moderators" ||
    action === "create_moderator" ||
    action === "set_moderator_active" ||
    action === "list_professional_accounts" ||
    action === "delete_professional_account"
  ) {
    const cstUser = await requireCst();
    if (!cstUser) return json({ error: "Accès CST refusé." }, 403);
    if (action === "list_professional_accounts") {
      const [mairieResult, orgResult] = await Promise.all([
        admin
          .from("mairies")
          .select(
            "id,name,account_user_id,is_active,approval_status,phone,communes(name),regions(name)",
          )
          .eq("approval_status", "approved")
          .not("account_user_id", "is", null)
          .order("name"),
        admin
          .from("organization_users")
          .select(
            "id,user_id,role,is_active,organization_id,unit_id,organizations!inner(id,name,code),organization_units(id,name,unit_type)",
          )
          .in("role", ["admin", "supervisor"])
          .eq("is_active", true),
      ]);
      if (mairieResult.error || orgResult.error)
        return json({ error: "Impossible de charger les comptes professionnels." }, 500);
      const mairieRows = (mairieResult.data ?? []) as unknown as MairieAccountRow[];
      const mairieIds = mairieRows.map((m) => m.account_user_id).filter(Boolean);
      const orgRows = ((orgResult.data ?? []) as unknown as OrganizationAccountRow[]).filter((r) =>
        ["NIGELEC", "NDE"].includes(r.organizations?.code),
      );
      const userIds = [...new Set([...mairieIds, ...orgRows.map((r) => r.user_id)])];
      const { data: authUsers, error: authUsersError } = userIds.length
        ? await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        : { data: { users: [] }, error: null };
      if (authUsersError)
        return json({ error: "Impossible de lire les identités des comptes professionnels." }, 500);
      const emailById = new Map((authUsers?.users ?? []).map((u) => [u.id, u.email ?? ""]));
      const accounts = [
        ...mairieRows.map((m) => ({
          key: "mairie:" + m.id,
          type: "mairie",
          entity_id: m.id,
          user_id: m.account_user_id,
          name: m.name,
          structure: m.communes?.name ?? "Mairie",
          region: m.regions?.name ?? "",
          email: emailById.get(m.account_user_id) ?? "",
          phone: m.phone ?? "",
          is_active: m.is_active,
          approval_status: m.approval_status,
        })),
        ...orgRows.map((r) => ({
          key: "organization:" + r.id,
          type: r.organizations.code.toLowerCase(),
          entity_id: r.id,
          user_id: r.user_id,
          name: r.organizations.name,
          structure: r.organization_units?.name ?? "Unité",
          region: r.organization_units?.unit_type ?? "",
          email: emailById.get(r.user_id) ?? "",
          phone: "",
          is_active: r.is_active,
          approval_status: "approved",
        })),
      ];
      return json({ accounts });
    }
    if (action === "delete_professional_account") {
      const type = String(body.account_type ?? ""),
        entityId = String(body.entity_id ?? ""),
        userId = String(body.user_id ?? "");
      if (
        !["mairie", "nigelec", "nde"].includes(type) ||
        !/^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(
          entityId,
        ) ||
        !/^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(userId)
      )
        return json({ error: "Compte professionnel invalide." }, 400);
      if (type === "mairie") {
        const { data: record, error } = await admin
          .from("mairies")
          .select("id,account_user_id,approval_status")
          .eq("id", entityId)
          .maybeSingle();
        if (
          error ||
          !record ||
          record.approval_status !== "approved" ||
          record.account_user_id !== userId
        )
          return json({ error: "Compte mairie approuvé introuvable." }, 404);
      } else {
        const { data: record, error } = await admin
          .from("organization_users")
          .select("id,user_id,organization_id,organizations!inner(code)")
          .eq("id", entityId)
          .eq("user_id", userId)
          .eq("is_active", true)
          .maybeSingle();
        if (
          error ||
          !record ||
          (record.organizations as unknown as { code?: string } | null)?.code !==
            (type === "nigelec" ? "NIGELEC" : "NDE")
        )
          return json({ error: "Compte NIGELEC/NDE actif introuvable." }, 404);
      }
      const [otherOrg, agent, cstAccount, moderator] = await Promise.all([
        admin
          .from("organization_users")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .neq("id", type === "mairie" ? "00000000-0000-0000-0000-000000000000" : entityId),
        admin
          .from("field_agents")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),
        admin
          .from("cst_accounts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),
        admin
          .from("moderator_profiles")
          .select("user_id", { count: "exact", head: true })
          .eq("user_id", userId),
      ]);
      if (otherOrg.error || agent.error || cstAccount.error || moderator.error)
        return json({ error: "Vérification des accès associés impossible." }, 500);
      if (
        (otherOrg.count ?? 0) > 0 ||
        (agent.count ?? 0) > 0 ||
        (cstAccount.count ?? 0) > 0 ||
        (moderator.count ?? 0) > 0
      )
        return json(
          {
            error:
              "Ce compte possède d’autres accès professionnels. Ils doivent être examinés avant sa suppression.",
          },
          409,
        );
      const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
      if (userError || !userData.user) return json({ error: "Identité Auth introuvable." }, 404);
      if (type === "mairie") {
        const { error } = await admin
          .from("mairies")
          .update({
            account_user_id: null,
            is_active: false,
            approval_status: "pending",
            updated_at: new Date().toISOString(),
          })
          .eq("id", entityId)
          .eq("account_user_id", userId);
        if (error) return json({ error: "Impossible de détacher le compte de la mairie." }, 500);
      } else {
        const { error } = await admin
          .from("organization_users")
          .delete()
          .eq("id", entityId)
          .eq("user_id", userId);
        if (error) return json({ error: "Impossible de retirer l’accès à l’organisation." }, 500);
      }
      const { error: rolesError } = await admin.from("user_roles").delete().eq("user_id", userId);
      if (rolesError)
        return json(
          {
            error:
              "Accès professionnel retiré, mais le nettoyage des rôles doit être repris manuellement.",
          },
          500,
        );
      const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
      if (deleteError)
        return json(
          {
            error:
              "Accès retiré, mais la suppression de l’identité Auth a échoué. Réessayez après vérification.",
          },
          500,
        );
      return json({ deleted: true });
    }
    if (action === "list_moderators") {
      const { data, error } = await admin
        .from("moderator_profiles")
        .select(
          "user_id,email,full_name,region_id,is_active,created_at,updated_at,regions(id,name,code)",
        )
        .order("created_at", { ascending: false });
      if (error) return json({ error: "Impossible de charger les modérateurs." }, 500);
      return json({ moderators: data ?? [] });
    }
    if (action === "create_moderator") {
      const email = String(body.email ?? "")
        .trim()
        .toLowerCase();
      const fullName = String(body.full_name ?? "").trim();
      const password = String(body.password ?? "");
      const regionId = String(body.region_id ?? "").trim();
      if (!/^\S+@\S+\.\S+$/.test(email) || fullName.length < 2 || password.length < 12 || !regionId)
        return json(
          { error: "Nom, email, région et mot de passe d’au moins 12 caractères requis." },
          400,
        );
      const { data: region, error: regionError } = await admin
        .from("regions")
        .select("id,name,code")
        .eq("id", regionId)
        .maybeSingle();
      if (regionError || !region) return json({ error: "Région invalide." }, 400);
      const { data: existing } = await admin
        .from("moderator_profiles")
        .select("user_id")
        .eq("email", email)
        .maybeSingle();
      if (existing) return json({ error: "Un modérateur utilise déjà cet email." }, 409);
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
        app_metadata: { pcs_role: "moderator" },
      });
      if (createError || !created.user)
        return json({ error: "Création du compte modérateur impossible." }, 400);
      const userId = created.user.id;
      const { data: role } = await admin
        .from("roles")
        .select("id")
        .eq("code", "moderator")
        .maybeSingle();
      if (!role) {
        await admin.auth.admin.deleteUser(userId);
        return json({ error: "Rôle modérateur introuvable." }, 500);
      }
      const { error: roleError } = await admin
        .from("user_roles")
        .insert({ user_id: userId, role_id: role.id });
      if (roleError) {
        await admin.auth.admin.deleteUser(userId);
        return json({ error: "Attribution du rôle modérateur impossible." }, 500);
      }
      const { error: profileError } = await admin.from("moderator_profiles").insert({
        user_id: userId,
        email,
        full_name: fullName,
        region_id: regionId,
        is_active: true,
      });
      if (profileError) {
        await admin.from("user_roles").delete().eq("user_id", userId).eq("role_id", role.id);
        await admin.auth.admin.deleteUser(userId);
        return json({ error: "Création du profil modérateur impossible." }, 500);
      }
      return json({ created: true, user_id: userId });
    }
    const userId = String(body.user_id ?? "").trim();
    const active = body.is_active === true;
    if (!userId) return json({ error: "Modérateur requis." }, 400);
    const { data: profile, error: profileError } = await admin
      .from("moderator_profiles")
      .select("user_id,is_active")
      .eq("user_id", userId)
      .maybeSingle();
    if (profileError || !profile) return json({ error: "Modérateur introuvable." }, 404);
    const { error: updateError } = await admin
      .from("moderator_profiles")
      .update({ is_active: active })
      .eq("user_id", userId);
    if (updateError) return json({ error: "Mise à jour du modérateur impossible." }, 500);
    const { error: authError } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: active ? "none" : "876000h",
    });
    if (authError) {
      await admin
        .from("moderator_profiles")
        .update({ is_active: profile.is_active })
        .eq("user_id", userId);
      return json({ error: "Mise à jour de l’accès Auth impossible." }, 500);
    }
    return json({ updated: true, is_active: active });
  }
  if (action === "status") {
    const { count, error } = await admin
      .from("cst_accounts")
      .select("id", { count: "exact", head: true });
    if (error) return json({ error: "État CST indisponible." }, 500);
    return json({ configured: (count ?? 0) > 0 });
  }
  if (action === "bootstrap") {
    const email = String(body.email ?? "")
        .trim()
        .toLowerCase(),
      password = String(body.password ?? "");
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 12)
      return json(
        { error: "Email professionnel valide et mot de passe d’au moins 12 caractères requis." },
        400,
      );
    const key = await hash("bootstrap:" + email);
    const { data: allowed, error: limitError } = await admin.rpc("consume_cst_auth_rate_limit", {
      p_key_hash: key,
      p_max_attempts: 3,
      p_window_seconds: 3600,
      p_block_seconds: 3600,
    });
    if (limitError || allowed !== true)
      return json({ error: "Création CST temporairement bloquée. Réessayez plus tard." }, 429);
    const { count } = await admin
      .from("cst_registration_lock")
      .select("id", { count: "exact", head: true });
    if ((count ?? 0) > 0)
      return json(
        { error: "Le compte CST a déjà été initialisé. L’inscription est définitivement fermée." },
        409,
      );
    const { data: userData, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { cst_account: true },
    });
    if (createError || !userData.user)
      return json({ error: "Création du compte CST impossible." }, 400);
    const { error: lockError } = await admin.from("cst_registration_lock").insert({ id: 1 });
    if (lockError) {
      await admin.auth.admin.deleteUser(userData.user.id);
      return json(
        { error: "Le compte CST a déjà été initialisé. L’inscription est définitivement fermée." },
        409,
      );
    }
    const { error: insertError } = await admin
      .from("cst_accounts")
      .insert({ id: 1, user_id: userData.user.id, email });
    if (insertError) {
      await admin.from("cst_registration_lock").delete().eq("id", 1);
      await admin.auth.admin.deleteUser(userData.user.id);
      return json({ error: "Création du compte CST impossible." }, 500);
    }
    return json({ created: true });
  }
  if (action === "login") {
    const email = String(body.email ?? "")
        .trim()
        .toLowerCase(),
      password = String(body.password ?? "");
    if (!email || !password) return json({ error: "Identifiants requis." }, 400);
    const key = await hash("login:" + email);
    const { data: allowed, error: limitError } = await admin.rpc("consume_cst_auth_rate_limit", {
      p_key_hash: key,
      p_max_attempts: 5,
      p_window_seconds: 600,
      p_block_seconds: 900,
    });
    if (limitError || allowed !== true)
      return json({ error: "Trop de tentatives. Réessayez plus tard." }, 429);
    const { data: account } = await admin
      .from("cst_accounts")
      .select("user_id")
      .eq("email", email)
      .maybeSingle();
    if (!account) return json({ error: "Identifiants invalides." }, 401);
    const client = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session || data.user.id !== account.user_id)
      return json({ error: "Identifiants invalides." }, 401);
    return json({ session: data.session, user: { id: data.user.id, email: data.user.email } });
  }
  return json({ error: "Action CST inconnue." }, 400);
});
