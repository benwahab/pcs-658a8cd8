import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "@/pcs/router";
import {
  getMyMairie,
  listAllCommunes,
  listRegions,
  loginAgent,
  lookupAgentByPhone,
  signupMairie,
} from "../services/mairie";
import { supabase } from "../lib/supabase";
import PasswordField from "../components/PasswordField";
import AgentConnectionHelp from "../components/AgentConnectionHelp";

type Mode = "mairie" | "agent" | "moderator";

type Region = { id: string; name: string };
type Commune = { id: string; name: string; region_id: string };
type Agent = {
  first_name: string;
  last_name: string;
  matricule: string;
  qualification: string;
};

export default function OperationalLogin() {
  const [mode] = useState<Mode>(() => {
    const value = new URLSearchParams(window.location.search).get("mode");
    return value === "agent" || value === "moderator" ? value : "mairie";
  });

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [name, setName] = useState("");
  const [mayorName, setMayorName] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("");
  const [commune, setCommune] = useState("");
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [allCommunes, setAllCommunes] = useState<Commune[]>([]);
  const [mairieCoords, setMairieCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);

  const [signup, setSignup] = useState(false);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [agentChallenge, setAgentChallenge] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([listRegions(), listAllCommunes()])
      .then(([regionList, communeList]) => {
        setRegions(regionList);
        setAllCommunes(communeList);
      })
      .catch((error) =>
        setError(
          error instanceof Error
            ? error.message
            : "Impossible de charger les régions et localités.",
        ),
      );
  }, []);

  useEffect(() => {
    setCommune("");
    setCommunes(
      region ? allCommunes.filter((item) => item.region_id === region) : [],
    );
  }, [region, allCommunes]);

  async function identifyAgent(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      const result = await lookupAgentByPhone(identifier);
      setAgent(result.agent as Agent);
      setAgentChallenge(result.challenge);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Numéro non reconnu.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (signup && password !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setBusy(true);

    try {
      if (!supabase) {
        setError("Supabase non configuré.");
        return;
      }

      if (signup) {
        await signupMairie({
          name,
          region_id: region,
          commune_id: commune,
          email: identifier,
          password,
          phone: phone.trim() || undefined,
          mayor_name: mayorName.trim(),
          latitude: mairieCoords?.lat,
          longitude: mairieCoords?.lng,
        });
        setPending(true);
        return;
      }

      if (mode === "agent") {
        if (!agentChallenge) {
          throw new Error(
            "Session de connexion agent manquante. Recommencez avec votre numéro.",
          );
        }

        await loginAgent(agentChallenge, password);
        navigate("/agent-terrain");
        return;
      }

      if (mode === "moderator") {
        if (password.length < 12) {
          throw new Error("Le mot de passe doit contenir au moins 12 caractères.");
        }

        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: identifier,
          password,
        });

        if (loginError) throw loginError;

        const { data: check, error: checkError } =
          await supabase.functions.invoke("cst-media-moderation", {
            body: { action: "list" },
          });

        if (checkError || check?.error || check?.scope !== "regional") {
          await supabase.auth.signOut();
          throw new Error(
            check?.error ??
              "Ce compte n’est pas un modérateur régional actif.",
          );
        }

        navigate("/moderateur");
        return;
      }

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: identifier,
        password,
      });

      if (loginError) throw loginError;

      const mairie = await getMyMairie();

      if (mairie?.is_active && mairie.approval_status === "approved") {
        navigate("/mairie");
      } else {
        await supabase.auth.signOut();
        throw new Error(
          mairie?.approval_status === "rejected"
            ? "Votre demande mairie a été refusée. Contactez l’administrateur PCS pour obtenir des informations."
            : "Votre demande mairie est en attente de validation. Le compte n’est pas encore activé.",
        );
      }
    } catch (error) {
      // Afficher les erreurs Supabase/PostgREST même si elles ne sont pas des
      // instances natives de Error, afin de diagnostiquer la connexion mairie.
      const details =
        error instanceof Error
          ? error.message
          : error && typeof error === "object" && "message" in error &&
              typeof (error as { message?: unknown }).message === "string"
            ? (error as { message: string }).message
            : error && typeof error === "object" && "details" in error &&
                typeof (error as { details?: unknown }).details === "string"
              ? (error as { details: string }).details
              : "Une erreur inattendue est survenue pendant la connexion.";
      console.error("[PCS mairie login]", error);
      setError(details);
    } finally {
      setBusy(false);
    }
  }

  if (mode === "agent" && !agent) {
    return (
      <section className="narrow authScreen">
        <h1>Espace agent terrain</h1>
        <p>
          Entrez votre numéro de téléphone professionnel pour vérifier votre
          compte.
        </p>

        <form className="card form" onSubmit={identifyAgent}>
          <label>
            Numéro de téléphone
            <input
              required
              type="tel"
              inputMode="tel"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              autoComplete="tel"
              placeholder="+227 90 00 00 00"
            />
          </label>

          {error && <p className="error">{error}</p>}

          <button className="button primary" disabled={busy}>
            {busy ? "Vérification…" : "Continuer"}
          </button>
        </form>

        <AgentConnectionHelp />

        <Link className="button" to="/">
          Retour
        </Link>
      </section>
    );
  }

  return (
    <section className="narrow authScreen">
      <h1>
        {signup
          ? "Créer le compte de la mairie"
          : mode === "agent"
            ? "Connexion agent terrain"
            : mode === "moderator"
              ? "Connexion modérateur"
              : "Connexion mairie"}
      </h1>

      {mode === "agent" && agent && (
        <div className="card">
          <strong>
            {agent.first_name} {agent.last_name}
          </strong>
          <p>Matricule : {agent.matricule}</p>
          <p>Qualité : {agent.qualification}</p>
        </div>
      )}

      {pending ? (
        <div className="card">
          <h2>Demande reçue</h2>
          <p>
            Votre demande de création de compte mairie a bien été enregistrée.
          </p>
          <p>
            Le compte reste inactif jusqu’à validation de l’habilitation par un
            administrateur PCS.
          </p>
          <button
            type="button"
            className="button"
            onClick={() => {
              setPending(false);
              setSignup(false);
              setError("");
              setIdentifier("");
              setPassword("");
              setConfirmPassword("");
              setPhone("");
            }}
          >
            Retour à la connexion
          </button>
        </div>
      ) : (
        <form className="card form" onSubmit={submit}>
          {signup && (
            <>
              <label>
                Nom de la mairie
                <input
                  required
                  minLength={2}
                  maxLength={150}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Mairie de Niamey"
                />
              </label>

              <label>
                Nom du maire
                <input
                  required
                  maxLength={120}
                  value={mayorName}
                  onChange={(event) => setMayorName(event.target.value)}
                  placeholder="Nom du maire"
                />
              </label>

              <label>
                Téléphone officiel
                <input
                  type="tel"
                  inputMode="tel"
                  maxLength={30}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+227 …"
                />
              </label>

              <label>
                Région
                <select
                  required
                  value={region}
                  onChange={(event) => setRegion(event.target.value)}
                >
                  <option value="">Choisir…</option>
                  {regions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Mairie / localité
                <select
                  required
                  disabled={!region}
                  value={commune}
                  onChange={(event) => setCommune(event.target.value)}
                >
                  <option value="">
                    {!region
                      ? "Choisir d’abord une région…"
                      : !communes.length
                        ? "Aucune localité disponible"
                        : "Choisir une localité…"}
                  </option>
                  {communes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="button"
                onClick={() =>
                  navigator.geolocation?.getCurrentPosition(
                    (position) =>
                      setMairieCoords({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                      }),
                    () =>
                      setError(
                        "Impossible d’obtenir la position GPS de la mairie.",
                      ),
                    {
                      enableHighAccuracy: true,
                      timeout: 10000,
                      maximumAge: 0,
                    },
                  )
                }
              >
                Utiliser la position GPS de la mairie
              </button>

              {mairieCoords && (
                <small>
                  GPS : {mairieCoords.lat.toFixed(5)},{" "}
                  {mairieCoords.lng.toFixed(5)}
                </small>
              )}
            </>
          )}

          {mode !== "agent" && (
            <label>
              Email
              <input
                required
                type="email"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
              />
            </label>
          )}

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

          <button className="button primary" type="submit" disabled={busy}>
            {busy ? "Traitement…" : signup ? "Envoyer la demande" : "Se connecter"}
          </button>
        </form>
      )}

      {mode === "mairie" && (
        <button
          className="button"
          onClick={() => {
            setSignup((value) => !value);
            setError("");
            setIdentifier("");
            setPassword("");
            setConfirmPassword("");
            setShowPassword(false);
          }}
        >
          {signup ? "J’ai déjà un compte" : "Demander la création d’un compte mairie"}
        </button>
      )}

      {mode === "agent" && (
        <button
          className="button"
          onClick={() => {
            setAgent(null);
            setAgentChallenge("");
            setError("");
            setPassword("");
            setShowPassword(false);
          }}
        >
          Changer de numéro
        </button>
      )}

      {mode === "agent" && <AgentConnectionHelp />}
    </section>
  );
}
