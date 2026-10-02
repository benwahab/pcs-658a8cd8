import { useEffect, useState } from "react";
import { Link, useNavigate } from "@/pcs/router";
import { supabase } from "../lib/supabase";
import {
  getMyOrganizationMembership,
  listOrganizationTransfers,
  acceptOrganizationTransfer,
  declineOrganizationTransfer,
  listOrganizationUnits,
  assignOrganizationAgency,
  listAgencyMissions,
  listAgencyAgents,
  assignAgencyMissionToAgent,
  createAgencyAgent,
} from "../services/organization";

export default function OrganizationDashboard() {
  const nav = useNavigate();
  const [membership, setMembership] = useState<any>(null),
    [transfers, setTransfers] = useState<any[]>([]),
    [units, setUnits] = useState<any[]>([]),
    [missions, setMissions] = useState<any[]>([]),
    [agents, setAgents] = useState<any[]>([]);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [agencyFor, setAgencyFor] = useState<Record<string, string>>({});
  const [agentForm, setAgentForm] = useState({
    first_name: "",
    last_name: "",
    matricule: "",
    qualification: "",
    phone: "",
    password: "",
  });
  async function load() {
    try {
      const m = await getMyOrganizationMembership();
      setMembership(m);
      if (!m) throw new Error("Compte organisationnel non habilité.");
      if (!m.unit_id) {
        const [t, u] = await Promise.all([
          listOrganizationTransfers(),
          listOrganizationUnits(m.organization_id),
        ]);
        setTransfers(t);
        setUnits(u.filter((x: any) => x.unit_type === "agency"));
      } else {
        const [ms, as] = await Promise.all([
          listAgencyMissions(m.unit_id),
          listAgencyAgents(m.organization_id, m.unit_id),
        ]);
        setMissions(ms);
        setAgents(as);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function logout() {
    await supabase?.auth.signOut();
    nav("/");
  }
  async function act(fn: () => Promise<any>) {
    setError("");
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opération impossible");
    } finally {
      setBusy(false);
    }
  }
  if (!membership && !error)
    return (
      <section className="narrow">
        <div className="card">Vérification du compte organisationnel…</div>
      </section>
    );
  const central = !membership?.unit_id;
  return (
    <section className="narrow">
      <div className="citizenSpaceTop">
        <div>
          <p className="eyebrow">{membership?.organization?.name ?? "ORGANISATION"}</p>
          <h1>{central ? "Centre de contrôle" : "Espace agence"}</h1>
          <p>
            {central
              ? "Transmission, acceptation et attribution des missions."
              : "Missions reçues et affectation aux agents de votre agence."}
          </p>
        </div>
        <button className="button" onClick={logout}>
          Déconnexion
        </button>
      </div>
      {error && <div className="card error">{error}</div>}
      {central ? (
        <>
          <div className="card">
            <h2>Transmissions reçues</h2>
            {!transfers.length ? (
              <p>Aucune transmission en attente ou historique disponible.</p>
            ) : (
              transfers.map((t: any) => (
                <article className="card" key={t.id}>
                  <strong>{t.reports?.reference_code ?? t.report_id}</strong>
                  <h3>{t.reports?.title ?? "Signalement transmis"}</h3>
                  <p>{t.reports?.description ?? ""}</p>
                  <small>Statut transmission : {t.status}</small>
                  {t.status === "pending" && (
                    <div className="actions">
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={() => act(() => acceptOrganizationTransfer(t.id))}
                      >
                        Accepter
                      </button>
                      <button
                        className="button"
                        disabled={busy}
                        onClick={() =>
                          act(() =>
                            declineOrganizationTransfer(
                              t.id,
                              "Signalement non pris en charge par notre organisation.",
                            ),
                          )
                        }
                      >
                        Refuser
                      </button>
                    </div>
                  )}
                  {t.status === "accepted" && (
                    <div className="form">
                      <label>
                        Agence
                        <select
                          value={agencyFor[t.id] ?? ""}
                          onChange={(e) => setAgencyFor({ ...agencyFor, [t.id]: e.target.value })}
                        >
                          <option value="">Choisir une agence…</option>
                          {units.map((u: any) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="button primary"
                        disabled={busy || !agencyFor[t.id]}
                        onClick={() => act(() => assignOrganizationAgency(t.id, agencyFor[t.id]))}
                      >
                        Attribuer à l'agence
                      </button>
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
          <div className="card">
            <h2>Agences</h2>
            {!units.length ? (
              <p>Aucune agence opérationnelle n'est encore créée.</p>
            ) : (
              units.map((u: any) => (
                <div className="row" key={u.id}>
                  <strong>{u.name}</strong>
                  <span>{u.code}</span>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <>
          <div className="card">
            <h2>{membership.unit?.name}</h2>
            <p>Missions reçues : {missions.length}</p>
            {!missions.length ? (
              <p>Aucune mission attribuée.</p>
            ) : (
              missions.map((m: any) => (
                <article className="card" key={m.id}>
                  <strong>{m.reports?.reference_code ?? m.report_id}</strong>
                  <h3>{m.reports?.title ?? "Mission"}</h3>
                  <p>{m.reports?.location_label ?? "Localisation GPS"}</p>
                  <label>
                    Agent
                    <select
                      defaultValue=""
                      onChange={(e) => act(() => assignAgencyMissionToAgent(m.id, e.target.value))}
                    >
                      <option value="">Affecter un agent…</option>
                      {agents.map((a: any) => (
                        <option key={a.id} value={a.id}>
                          {a.first_name} {a.last_name} — {a.matricule}
                        </option>
                      ))}
                    </select>
                  </label>
                </article>
              ))
            )}
          </div>
          <div className="card">
            <h2>Créer un agent terrain</h2>
            <div className="form">
              <input
                placeholder="Prénom"
                value={agentForm.first_name}
                onChange={(e) => setAgentForm({ ...agentForm, first_name: e.target.value })}
              />
              <input
                placeholder="Nom"
                value={agentForm.last_name}
                onChange={(e) => setAgentForm({ ...agentForm, last_name: e.target.value })}
              />
              <input
                placeholder="Matricule"
                value={agentForm.matricule}
                onChange={(e) => setAgentForm({ ...agentForm, matricule: e.target.value })}
              />
              <input
                placeholder="Qualification"
                value={agentForm.qualification}
                onChange={(e) => setAgentForm({ ...agentForm, qualification: e.target.value })}
              />
              <input
                placeholder="Téléphone"
                value={agentForm.phone}
                onChange={(e) => setAgentForm({ ...agentForm, phone: e.target.value })}
              />
              <input
                type="password"
                minLength={8}
                placeholder="Mot de passe"
                value={agentForm.password}
                onChange={(e) => setAgentForm({ ...agentForm, password: e.target.value })}
              />
              <button
                className="button primary"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await createAgencyAgent(agentForm);
                    setAgentForm({
                      first_name: "",
                      last_name: "",
                      matricule: "",
                      qualification: "",
                      phone: "",
                      password: "",
                    });
                  })
                }
              >
                Créer l'agent
              </button>
            </div>
          </div>
          <div className="card">
            <h2>Agents actifs</h2>
            {!agents.length ? (
              <p>Aucun agent dans cette agence.</p>
            ) : (
              agents.map((a: any) => (
                <div className="row" key={a.id}>
                  <strong>
                    {a.first_name} {a.last_name}
                  </strong>
                  <span>
                    {a.qualification} · {a.matricule}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}
      <Link className="button" to="/">
        Retour à PCS
      </Link>
    </section>
  );
}
