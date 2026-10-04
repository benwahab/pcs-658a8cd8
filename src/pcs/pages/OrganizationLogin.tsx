import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "@/pcs/router";
import { supabase } from "../lib/supabase";
import { getMyOrganizationMembership } from "../services/organization";
import PasswordField from "../components/PasswordField";

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
        const { error: signupError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo:
              window.location.origin +
              (org === "NIGELEC"
                ? "/connexion-nigelec"
                : "/connexion-nde"),
            data: {
              full_name: fullName.trim(),
              requested_organization: org,
            },
          },
        });

        if (signupError) throw signupError;

        await supabase.auth.signOut();
        setInfo(
          `Compte ${space.label} créé. Confirmez votre email ; l’accès sera actif dès que votre habilitation ${space.label} aura été enregistrée par un administrateur.`,
        );
        setSignup(false);
        setPassword("");
        return;
      }

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
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
          <label>
            Nom complet
            <input
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </label>
        )}

        <label>
          Email professionnel
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
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

      <button
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
      </button>

      <Link className="button" to="/">
        Retour
      </Link>
    </section>
  );
}
