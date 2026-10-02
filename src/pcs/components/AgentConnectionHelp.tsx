import { useState } from "react";
import type { FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAgentLoginHelp } from "@/lib/agent-help.functions";

export default function AgentConnectionHelp() {
  const ask = useServerFn(getAgentLoginHelp);
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState("");
  const [steps, setSteps] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSteps("");
    if (problem.trim().length < 10) {
      setError("Décrivez le problème en au moins 10 caractères.");
      return;
    }
    setBusy(true);
    try {
      const r = await ask({ data: { problem } });
      if (r.ok) setSteps(r.steps);
      else setError(r.error);
    } catch {
      setError("L'assistant est indisponible. Vérifiez votre connexion puis réessayez.");
    } finally {
      setBusy(false);
    }
  }

  if (!open)
    return (
      <button type="button" className="button" onClick={() => setOpen(true)}>
        Un problème pour vous connecter ?
      </button>
    );

  return (
    <form className="card form" onSubmit={submit}>
      <h2>Aide à la connexion</h2>
      <label>
        Décrivez ce qui se passe
        <textarea
          value={problem}
          maxLength={1000}
          onChange={(e) => setProblem(e.target.value)}
          placeholder="Ex. : mon numéro n'est pas reconnu, ou le mot de passe est refusé…"
        />
      </label>
      <small>Ne saisissez jamais votre mot de passe ici.</small>
      {error && <p className="error">{error}</p>}
      {steps && <div style={{ whiteSpace: "pre-wrap" }}>{steps}</div>}
      <button className="button primary" disabled={busy}>
        {busy ? "Analyse…" : "Obtenir des étapes de dépannage"}
      </button>
      <button type="button" className="button" onClick={() => setOpen(false)}>
        Fermer
      </button>
    </form>
  );
}
