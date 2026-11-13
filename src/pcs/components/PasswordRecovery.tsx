import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  email: string;
  onEmailChange: (value: string) => void;
  label?: string;
};

export default function PasswordRecovery({
  email,
  onEmailChange,
  label = "Mot de passe oublié ?",
}: Props) {
  const [view, setView] = useState<"closed" | "request" | "update" | "done">("closed");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setView("update");
        setError("");
        setMessage("");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function requestRecovery() {
    setError("");
    setMessage("");
    const address = email.trim().toLowerCase();
    if (!address) {
      setError("Saisissez votre adresse email professionnelle.");
      return;
    }
    if (!supabase) {
      setError("Service d’authentification indisponible.");
      return;
    }
    setBusy(true);
    try {
      const redirectTo = window.location.origin + window.location.pathname + window.location.search;
      const { error: requestError } = await supabase.auth.resetPasswordForEmail(address, {
        redirectTo,
      });
      if (requestError) throw requestError;
      setMessage(
        "Si cette adresse correspond à un compte actif, un email de récupération a été envoyé. Vérifiez également vos courriers indésirables.",
      );
      setView("done");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Impossible d’envoyer le lien. Réessayez plus tard.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function updatePassword() {
    setError("");
    setMessage("");
    if (newPassword.length < 12) {
      setError("Le nouveau mot de passe doit contenir au moins 12 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (!supabase) {
      setError("Service d’authentification indisponible.");
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      await supabase.auth.signOut({ scope: "local" });
      setNewPassword("");
      setConfirmPassword("");
      setView("done");
      setMessage("Votre mot de passe a été modifié. Vous pouvez maintenant vous connecter.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "La modification du mot de passe a échoué.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (view === "closed") {
    return (
      <button
        type="button"
        className="button pcsPasswordRecoveryLink"
        onClick={() => {
          setView("request");
          setError("");
          setMessage("");
        }}
      >
        {label}
      </button>
    );
  }

  if (view === "update") {
    return (
      <section
        className="card form pcsPasswordRecovery"
        aria-label="Définir un nouveau mot de passe"
      >
        <h2>Nouveau mot de passe</h2>
        <label>
          Nouveau mot de passe
          <input
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </label>
        <label>
          Confirmer le nouveau mot de passe
          <input
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="button primary" disabled={busy} onClick={updatePassword}>
          {busy ? "Mise à jour…" : "Enregistrer le nouveau mot de passe"}
        </button>
      </section>
    );
  }

  return (
    <section className="card form pcsPasswordRecovery" aria-label="Récupération du mot de passe">
      <h2>{view === "done" ? "Récupération du mot de passe" : "Récupérer votre accès"}</h2>
      {view === "request" && (
        <label>
          Email professionnel
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
          />
        </label>
      )}
      {message && (
        <p className="pcsPasswordRecoveryMessage" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {view === "request" && (
        <button type="button" className="button primary" disabled={busy} onClick={requestRecovery}>
          {busy ? "Envoi…" : "Envoyer le lien de récupération"}
        </button>
      )}
      <button
        type="button"
        className="button"
        onClick={() => {
          setView("closed");
          setError("");
          setMessage("");
        }}
      >
        {view === "done" ? "Retour à la connexion" : "Annuler"}
      </button>
    </section>
  );
}
