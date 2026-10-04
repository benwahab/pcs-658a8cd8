import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "@/pcs/router";
import { supabase } from "../lib/supabase";
import { getMyOrganizationMembership } from "../services/organization";
import PasswordField from "../components/PasswordField";
import { listRegions, listCommunes } from "../services/mairie";

const ORG_SPACES = {
  NIGELEC: {
    label: "NIGELEC",
    full: "Société Nigérienne d’Électricité",
    icon: "⚡",
    theme: "orgNigelec",
  },
  NDE: {
    label: "NDE",
    full: "Niger Distribution des Eaux",
    icon: "💧",
    theme: "orgNde",
  },
} as const;

export type OrgCode = keyof typeof ORG_SPACES;

export default function OrganizationLogin({ org }: { org: OrgCode }) {
  const space = ORG_SPACES[org];
  const navigate = useNavigate();
  const location = useLocation();
  const requestedAccountType = new URLSearchParams(location.search.replace(/^\?/, "")).get("type");
  const expectedUnitType = requestedAccountType === "central" || requestedAccountType === "agency" ? requestedAccountType : null;

  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [structureName, setStructureName] = useState("");
  const [phone, setPhone] = useState("");
  const [regions, setRegions] = useState<any[]>([]);
  const [communes, setCommunes] = useState<any[]>([]);
  const [regionId, setRegionId] = useState("");
  const [communeId, setCommuneId] = useState("");

  useEffect(() => {
    if (!signup) return;
    let active = true;
    listRegions().then((items) => { if (active) setRegions(items); }).catch((e) => { if (active) setError(e instanceof Error ? e.message : "Chargement des régions impossible."); });
    return () => { active = false; };
  }, [signup]);

  useEffect(() => {
    let active = true;
    setCommunes([]);
    setCommuneId("");
    if (!regionId) return;
    listCommunes(regionId).then((items) => { if (active) setCommunes(items); }).catch((e) => { if (active) setError(e instanceof Error ? e.message : "Chargement des localités impossible."); });
    return () => { active = false; };
  }, [regionId]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setInfo("");

    if (signup && password !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    if (!supabase) {
      setError("Supabase non configuré.");
      return;
    }

    setBusy(true);

    try {
      if (signup) {
        if (!regionId || !communeId) throw new Error("Sélectionnez une région et une localité valides.");
        const { data, error: signupError } = await supabase.functions.invoke("organization-signup", {
          body: {
            organization_code: org,
            structure_name: structureName.trim(),
            full_name: fullName.trim(),
            phone: phone.trim(),
            region_id: regionId,
            commune_id: communeId,
            email: email.trim(),
            password,
          },
        });
        if (signupError) {
          const context = (signupError as any).context;
          let message = signupError.message || "Impossible d’enregistrer la demande.";
          if (context instanceof Response) {
            try { const payload = await context.clone().json(); if (typeof payload?.error === "string") message = payload.error; } catch {}
          }
          throw new Error(message);
        }
        if (data?.error) throw new Error(data.error);
        setInfo(data?.message || "Demande reçue. Aucun accès professionnel avant approbation du CST.");
        setSignup(false);
        setPassword("");
        setConfirmPassword("");
        setStructureName("");
        setFullName("");
        setPhone("");
        setRegionId("");
        setCommuneId("");
        setEmail("");
        return;
      }

      const loginEmail = expectedUnitType === "agency"
        ? `${org.toLowerCase()}+${email.trim().toLowerCase()}@agency.pcs.invalid`
        : email.trim();
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (loginError) throw loginError;

      const membership = await getMyOrganizationMembership();

      if (!membership || membership.organization?.code?.toUpperCase() !== org) {
        await supabase.auth.signOut();
        throw new Error(
          membership
            ? `Ce compte appartient à ${membership.organization?.name}, pas à ${space.label}.`
            : `Ce compte n’est pas encore habilité dans l’espace ${space.label}.`,
        );
      }

      if (expectedUnitType && membership.unit?.unit_type !== expectedUnitType) {
        await supabase.auth.signOut();
        throw new Error(
          expectedUnitType === "central"
            ? `Cet accès est réservé au compte central ${space.label}. Utilisez l’accès aux comptes agences si votre compte appartient à une agence.`
            : `Cet accès est réservé aux comptes agences ${space.label}. Utilisez l’accès au compte central si vous gérez l’organisation centrale.`,
        );
      }

      navigate("/organisation");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Connexion impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`narrow authScreen orgSpace ${space.theme}`}>
      <p className="eyebrow">ESPACE {space.label}</p>
      <h1>
        {space.icon}{" "}
        {signup
          ? `Création de compte ${space.label}`
          : expectedUnitType === "central"
            ? `Connexion au compte central ${space.label}`
            : expectedUnitType === "agency"
              ? `Connexion à un compte agence ${space.label}`
              : `Connexion ${space.label}`}
      </h1>
      <p>{space.full}</p>

      <form className="card form" onSubmit={submit}>
        {signup && (
          <>
            <label>
              Nom de la structure locale
              <input required minLength={2} maxLength={150} value={structureName} onChange={(event) => setStructureName(event.target.value)} />
            </label>
            <label>
              Nom du responsable
              <input required minLength={2} maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} />
            </label>
            <label>
              Région
              <select required value={regionId} onChange={(event) => setRegionId(event.target.value)}>
                <option value="">Choisir une région</option>
                {regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}
              </select>
            </label>
            <label>
              Localité
              <select required value={communeId} onChange={(event) => setCommuneId(event.target.value)} disabled={!regionId || communes.length === 0}>
                <option value="">Choisir une localité</option>
                {communes.map((commune) => <option key={commune.id} value={commune.id}>{commune.name}</option>)}
              </select>
            </label>
            <label>
              Téléphone du responsable (facultatif)
              <input type="tel" maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} />
            </label>
          </>
        )}

        <label>
          {expectedUnitType === "agency" ? "Code unique de l’agence" : "Email professionnel"}
          <input
            required
            type={expectedUnitType === "agency" ? "text" : "email"}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete={expectedUnitType === "agency" ? "username" : "email"}
            placeholder={expectedUnitType === "agency" ? "Ex. NIG-NIAMEY-01" : undefined}
          />
        </label>

        <PasswordField
          label="Mot de passe"
          value={password}
          onChange={setPassword}
          visible={showPassword}
          onToggle={() => setShowPassword((value) => !value)}
        />

        {signup && (
          <PasswordField
            label="Confirmer le mot de passe"
            value={confirmPassword}
            onChange={setConfirmPassword}
            confirmation
            visible={showPassword}
            onToggle={() => setShowPassword((value) => !value)}
          />
        )}

        {error && <p className="error">{error}</p>}
        {info && <p>{info}</p>}

        <button className="button primary" type="submit" disabled={busy}>
          {busy
            ? "Veuillez patienter…"
            : signup
              ? `Créer mon compte ${space.label}`
              : "Se connecter"}
        </button>
      </form>

      {expectedUnitType !== "agency" && <button
        className="button"
        onClick={() => {
          setSignup((value) => !value);
          setError("");
          setInfo("");
          setPassword("");
          setConfirmPassword("");
          setShowPassword(false);
        }}
      >
        {signup ? "J’ai déjà un compte" : `Créer un compte ${space.label}`}
      </button>}

      <Link className="button" to="/">
        Retour
      </Link>
    </section>
  );
}
