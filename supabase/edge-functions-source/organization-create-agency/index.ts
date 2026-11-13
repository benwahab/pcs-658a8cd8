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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return json({ error: "Configuration du service indisponible." }, 500);

    const token = req.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim();
    if (!token) return json({ error: "Session requise. Connectez-vous puis réessayez." }, 401);

    const db = createClient(url, serviceKey);
    const {
      data: { user },
      error: userError,
    } = await db.auth.getUser(token);
    if (userError || !user) return json({ error: "Session invalide. Reconnectez-vous." }, 401);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Les données envoyées sont invalides." }, 400);
    }

    const organizationId = String(body.organization_id ?? "").trim();
    const name = String(body.name ?? "").trim();
    const code = String(body.code ?? "")
      .trim()
      .toUpperCase();
    const adminPassword = String(body.admin_password ?? "");

    if (!organizationId || !name || !code || !adminPassword)
      return json({ error: "Tous les champs sont obligatoires." }, 400);
    if (name.length < 2 || name.length > 150)
      return json({ error: "Le nom de l’agence doit contenir entre 2 et 150 caractères." }, 400);
    if (!/^[A-Z0-9_-]{2,40}$/.test(code))
      return json(
        { error: "Le code doit contenir de 2 à 40 lettres, chiffres, tirets ou tirets bas." },
        400,
      );
    if (adminPassword.length < 8 || adminPassword.length > 128)
      return json({ error: "Le mot de passe doit contenir entre 8 et 128 caractères." }, 400);

    const { data: membership, error: membershipError } = await db
      .from("organization_users")
      .select("organization_id, unit_id, role, organization_units!inner(unit_type,is_active)")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .in("role", ["admin", "supervisor"])
      .eq("organization_units.unit_type", "central")
      .eq("organization_units.is_active", true)
      .maybeSingle();
    if (membershipError) {
      console.error("organization-create-agency: membership check failed", membershipError.message);
      return json({ error: "Impossible de vérifier les droits du compte central." }, 500);
    }
    if (!membership)
      return json(
        { error: "Seul le compte central actif de cette organisation peut créer une agence." },
        403,
      );

    const { data: org, error: orgError } = await db
      .from("organizations")
      .select("id,code")
      .eq("id", organizationId)
      .eq("is_active", true)
      .maybeSingle();
    if (orgError || !org) return json({ error: "Organisation invalide ou inactive." }, 400);
    if (!["NIGELEC", "NDE"].includes(String(org.code).toUpperCase()))
      return json(
        { error: "La création de compte d’agence n’est pas autorisée pour cette organisation." },
        403,
      );

    const centralUnitId = String(membership.unit_id ?? "");
    if (!centralUnitId)
      return json(
        { error: "Le compte connecté n’est pas rattaché à un compte central précis." },
        403,
      );

    const { data: existingUnit } = await db
      .from("organization_units")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("code", code)
      .maybeSingle();
    if (existingUnit)
      return json({ error: "Ce code d’agence est déjà utilisé dans cette organisation." }, 409);

    // Identifiant interne technique : l’agence se connecte avec son code, jamais avec un email.
    const adminEmail = `${String(org.code).toLowerCase()}+${code.toLowerCase()}@agency.pcs.invalid`;
    const { data: existingUser } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (existingUser?.users?.some((u) => u.email?.toLowerCase() === adminEmail))
      return json({ error: "Ce code d’agence est déjà associé à un compte de connexion." }, 409);

    const { data: unit, error: unitError } = await db
      .from("organization_units")
      .insert({
        organization_id: organizationId,
        name,
        code,
        unit_type: "agency",
        parent_unit_id: centralUnitId,
        email: null,
      })
      .select("id,name,code,organization_id,region_id,latitude,longitude,location_label")
      .single();
    if (unitError || !unit) {
      console.error("organization-create-agency: unit creation failed", unitError?.message);
      return json(
        {
          error:
            unitError?.code === "23505"
              ? "Ce code d’agence est déjà utilisé dans cette organisation."
              : "Création de l’agence impossible.",
        },
        400,
      );
    }

    const { data: created, error: createError } = await db.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        role: "organization_unit_admin",
        organization_id: organizationId,
        unit_id: unit.id,
      },
    });
    if (createError || !created.user) {
      await db.from("organization_units").delete().eq("id", unit.id);
      return json(
        {
          error: createError?.message?.includes("already been registered")
            ? "Cette adresse email est déjà associée à un compte."
            : "Création du compte de connexion de l’agence impossible.",
        },
        400,
      );
    }

    const { error: memberError } = await db.from("organization_users").insert({
      user_id: created.user.id,
      organization_id: organizationId,
      unit_id: unit.id,
      role: "admin",
      is_active: true,
    });
    if (memberError) {
      await db.auth.admin.deleteUser(created.user.id);
      await db.from("organization_units").delete().eq("id", unit.id);
      console.error("organization-create-agency: membership creation failed", memberError.message);
      return json(
        {
          error:
            "L’agence a été préparée, mais son habilitation a échoué. Aucun compte incomplet n’a été conservé.",
        },
        500,
      );
    }

    return json({
      agency: unit,
      admin_user_id: created.user.id,
      message:
        "Le compte d’agence a été créé. L’agence peut maintenant se connecter avec son code unique et son mot de passe.",
    });
  } catch (error) {
    console.error("organization-create-agency: unexpected error", error);
    return json(
      { error: "Une erreur inattendue est survenue lors de la création de l’agence." },
      500,
    );
  }
});
