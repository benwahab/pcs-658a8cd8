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

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Configuration du service indisponible." }, 500);
  const db = createClient(url, serviceKey);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Données invalides." }, 400);
  }

  const orgCode = String(body.organization_code ?? "")
    .trim()
    .toUpperCase();
  const structureName = String(body.structure_name ?? "").trim();
  const fullName = String(body.full_name ?? "").trim();
  const regionId = String(body.region_id ?? "").trim();
  const communeId = String(body.commune_id ?? "").trim();
  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(body.password ?? "");
  const phone = String(body.phone ?? "").trim();

  if (![orgCode, structureName, fullName, regionId, communeId, email, password].every(Boolean))
    return json({ error: "Tous les champs obligatoires doivent être renseignés." }, 400);
  if (!["NIGELEC", "NDE"].includes(orgCode))
    return json({ error: "Organisation non autorisée." }, 400);
  if (structureName.length < 2 || structureName.length > 150)
    return json({ error: "Le nom de la structure doit contenir entre 2 et 150 caractères." }, 400);
  if (fullName.length < 2 || fullName.length > 120)
    return json({ error: "Le nom du responsable doit contenir entre 2 et 120 caractères." }, 400);
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254)
    return json({ error: "Adresse email invalide." }, 400);
  if (password.length < 8 || password.length > 128)
    return json({ error: "Le mot de passe doit contenir entre 8 et 128 caractères." }, 400);
  if (phone.length > 30) return json({ error: "Numéro de téléphone invalide." }, 400);

  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = req.headers.get("cf-connecting-ip")?.trim() || forwarded || "unknown";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(realIp + "|pcs-organization-signup"),
  );
  const keyHash = Array.from(new Uint8Array(digest))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  const { data: allowed, error: rateError } = await db.rpc("consume_mairie_signup_rate_limit", {
    p_key_hash: keyHash,
    p_max_attempts: 5,
    p_window_seconds: 900,
    p_block_seconds: 1800,
  });
  if (rateError)
    return json({ error: "Service temporairement indisponible. Réessayez plus tard." }, 503);
  if (allowed === false) return json({ error: "Trop de tentatives. Réessayez plus tard." }, 429);

  const { data: org, error: orgError } = await db
    .from("organizations")
    .select("id,code,name,is_active")
    .eq("code", orgCode)
    .eq("is_active", true)
    .maybeSingle();
  if (orgError || !org) return json({ error: "Organisation introuvable ou inactive." }, 400);

  const { data: commune, error: communeError } = await db
    .from("communes")
    .select("id,name,region_id,is_active,regions(id,name)")
    .eq("id", communeId)
    .eq("region_id", regionId)
    .eq("is_active", true)
    .maybeSingle();
  if (communeError || !commune)
    return json(
      { error: "La localité ne correspond pas à la région sélectionnée ou est inactive." },
      400,
    );

  const { data: existingRequest, error: duplicateError } = await db
    .from("organization_signup_requests")
    .select("id")
    .eq("organization_id", org.id)
    .eq("commune_id", communeId)
    .in("status", ["pending", "approved"])
    .maybeSingle();
  if (duplicateError)
    return json({ error: "Impossible de vérifier les demandes existantes." }, 500);
  if (existingRequest)
    return json(
      { error: "Une demande ou un compte pour cette structure existe déjà dans cette localité." },
      409,
    );

  const { data: existingUnit, error: unitError } = await db
    .from("organization_units")
    .select("id")
    .eq("organization_id", org.id)
    .eq("commune_id", communeId)
    .eq("unit_type", "central")
    .eq("is_active", true)
    .maybeSingle();
  if (unitError) return json({ error: "Impossible de vérifier les comptes existants." }, 500);
  if (existingUnit)
    return json(
      { error: "Un compte central existe déjà pour cette structure dans cette localité." },
      409,
    );

  const { data: userResult, error: userError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, organization_pending: true },
  });
  if (userError || !userResult.user) {
    const message = userError?.message ?? "Création du compte impossible.";
    return json(
      {
        error: /already registered|already been registered/i.test(message)
          ? "Cette adresse email est déjà utilisée par un compte PCS."
          : "Création du compte de demande impossible.",
      },
      400,
    );
  }
  const userId = userResult.user.id;
  const rollback = async () => {
    await db.auth.admin.deleteUser(userId);
  };

  const { error: profileError } = await db
    .from("profiles")
    .upsert({ id: userId, full_name: fullName, phone: phone || null });
  if (profileError) {
    await rollback();
    return json({ error: "Création du profil impossible." }, 500);
  }

  const { error: requestError } = await db.from("organization_signup_requests").insert({
    user_id: userId,
    organization_id: org.id,
    email,
    full_name: fullName,
    structure_name: structureName,
    region_id: regionId,
    commune_id: communeId,
    phone: phone || null,
    status: "pending",
  });
  if (requestError) {
    await rollback();
    return json(
      {
        error:
          requestError.code === "23505"
            ? "Une demande ou un compte pour cette structure existe déjà dans cette localité."
            : "Enregistrement de la demande impossible.",
      },
      requestError.code === "23505" ? 409 : 500,
    );
  }

  return json({
    status: "pending",
    message: "Demande reçue. Aucun accès professionnel ne sera accordé avant l’approbation du CST.",
  });
});
