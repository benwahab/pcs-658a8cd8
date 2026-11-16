import { useEffect, useState } from "react";
import { Link, useNavigate } from "@/pcs/router";
import { supabase } from "../lib/supabase";
import PasswordField from "../components/PasswordField";
import {
  getMyOrganizationMembership,
  listOrganizationTransfers,
  acceptOrganizationTransfer,
  declineOrganizationTransfer,
  assignOrganizationAgency,
  listOrganizationUnits,
  listAgencyMissions,
  listAgencyAgents,
  assignAgencyMissionToAgent,
  createAgencyAgent,
  createOrganizationAgency,
  listOrganizationUnitAssignments,
  listPendingOrganizationResolutionMedia,
  listOrganizationReportMedia,
  reviewOrganizationResolutionMedia,
  uploadOrganizationLogo,
} from "../services/organization";
import type { OrganizationMembership } from "../services/organization";
import type {
  AgencyAgent,
  AgencyMission,
  OrganizationTransfer,
  OrganizationUnitAssignment,
  OrganizationUnitListItem,
} from "../types/organization";

export default function OrganizationDashboard() {
  const nav = useNavigate();
  const [membership, setMembership] = useState<OrganizationMembership | null>(null),
    [transfers, setTransfers] = useState<OrganizationTransfer[]>([]),
    [resolutionMedia, setResolutionMedia] = useState<Awaited<ReturnType<typeof listPendingOrganizationResolutionMedia>>>([]),
    [transferMedia, setTransferMedia] = useState<Awaited<ReturnType<typeof listOrganizationReportMedia>>>([]),
    [units, setUnits] = useState<OrganizationUnitListItem[]>([]),
    [missions, setMissions] = useState<AgencyMission[]>([]),
    [agencyMissions, setAgencyMissions] = useState<OrganizationUnitAssignment[]>([]),
    [agents, setAgents] = useState<AgencyAgent[]>([]);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [organizationLogo, setOrganizationLogo] = useState(""),
    [logoBusy, setLogoBusy] = useState(false);
  const [agentForm, setAgentForm] = useState({
    first_name: "",
    last_name: "",
    matricule: "",
    qualification: "",
    phone: "",
    password: "",
  });
  const [agencyForm, setAgencyForm] = useState({
    name: "",
    code: "",
    admin_password: "",
    confirm_password: "",
  });
  const [showAgencyPassword, setShowAgencyPassword] = useState(false);
  const [agencySelection, setAgencySelection] = useState<Record<string, string>>({});

  async function load() {
    try {
      const m = await getMyOrganizationMembership();
      setMembership(m);
      setOrganizationLogo(m?.organization?.logo_url ?? "");
      if (!m) throw new Error("Compte organisationnel non habilité.");
      if (m.unit?.unit_type === "central" && m.organization_id && m.unit_id) {
        const t = await listOrganizationTransfers();
        const [u, am, rm, media] = await Promise.all([
          listOrganizationUnits(m.organization_id, m.unit_id),
          listOrganizationUnitAssignments(m.organization_id),
          listPendingOrganizationResolutionMedia(),
          listOrganizationReportMedia(t.map((item) => item.report_id)),
        ]);
        setTransfers(t);
        setResolutionMedia(rm);
        setTransferMedia(media);
        setUnits(u.filter((x) => x.unit_type === "agency"));
        setAgencyMissions(am);
      } else if (m.unit?.unit_type === "agency" && m.organization_id && m.unit_id) {
        const [t, ms, as] = await Promise.all([
          listOrganizationTransfers(),
          listAgencyMissions(m.unit_id),
          listAgencyAgents(m.organization_id, m.unit_id),
        ]);
        const media = await listOrganizationReportMedia(ms.map((item) => item.report_id));
        setTransfers(t);
        setMissions(ms);
        setAgents(as);
        setTransferMedia(media);
      } else {
        throw new Error("Compte organisationnel incomplet : unité ou organisation manquante.");
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
  async function reviewResolutionMedia(mediaId: string, approve: boolean) {
    await act(() =>
      reviewOrganizationResolutionMedia(
        mediaId,
        approve,
        approve ? undefined : "Preuve insuffisante : une nouvelle intervention est requise.",
      ),
    );
  }
  async function act(fn: () => Promise<unknown>) {
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
  if (!membership && error)
    return (
      <section className="narrow">
        <div className="card">
          <h1>Accès organisationnel indisponible</h1>
          <p className="error">{error}</p>
          <p>Vérifiez que votre compte est actif et associé à une organisation.</p>
          <button className="button primary" onClick={logout}>
            Se reconnecter
          </button>
        </div>
      </section>
    );
  const central = membership?.unit?.unit_type === "central";
  return (
    <section className="organizationDashboard">
      <aside className="organizationSidebar">
        <div className="organizationBrand">
          <span>PCS</span>
          <small>ESPACE PROFESSIONNEL</small>
        </div>
        <p>MENU PRINCIPAL</p>
        <nav>
          <a className="active" href="#org-home">
            ⌂ Tableau de bord
          </a>
          <a href="#org-transfers">▣ Transmissions</a>
          <a href="#org-missions">◉ Missions</a>
          <a href="#org-agencies">⌖ Agences et agents</a>
          <a href="#org-settings">⚙ Paramètres</a>
        </nav>
        <div className="organizationSidebarFoot">
          <span className="orgOnlineDot" />
          <div>
            <strong>Compte actif</strong>
            <small>{membership?.organization?.name ?? "Organisation PCS"}</small>
          </div>
        </div>
      </aside>
      <main className="organizationMain" id="org-home">
        <div className="citizenSpaceTop orgPageHeading">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {organizationLogo && (
              <img
                src={organizationLogo}
                alt={"Logo " + (membership?.organization?.name ?? "organisation")}
                style={{
                  width: 64,
                  height: 64,
                  objectFit: "contain",
                  borderRadius: 12,
                  background: "#fff",
                  padding: 5,
                }}
              />
            )}
            <div>
              <p className="eyebrow">{membership?.organization?.name ?? "ORGANISATION"}</p>
              <h1>{central ? "Centre de contrôle" : "Espace agence"}</h1>
              <p>
                {central
                  ? "Transmission, acceptation et attribution des missions."
                  : "Missions reçues et affectation aux agents de votre agence."}
              </p>
            </div>
          </div>
          <button className="button" onClick={logout}>
            Déconnexion
          </button>
        </div>
        <section className="orgKpiGrid" aria-label="Indicateurs de l'espace professionnel">
          {central ? (
            <>
              <article className="orgKpiCard">
                <span className="orgKpiIcon violet">⇄</span>
                <div>
                  <small>Transmissions en attente</small>
                  <strong>{transfers.filter((item) => item.status === "pending").length}</strong>
                  <span>À examiner par la direction</span>
                </div>
              </article>
              <article className="orgKpiCard">
                <span className="orgKpiIcon blue">⌖</span>
                <div>
                  <small>Agences rattachées</small>
                  <strong>{units.length}</strong>
                  <span>Unités opérationnelles</span>
                </div>
              </article>
              <article className="orgKpiCard">
                <span className="orgKpiIcon green">▣</span>
                <div>
                  <small>Missions locales</small>
                  <strong>{agencyMissions.length}</strong>
                  <span>Suivi des agences</span>
                </div>
              </article>
            </>
          ) : (
            <>
              <article className="orgKpiCard">
                <span className="orgKpiIcon violet">▣</span>
                <div>
                  <small>Missions reçues</small>
                  <strong>{missions.length}</strong>
                  <span>Attribuées à cette agence</span>
                </div>
              </article>
              <article className="orgKpiCard">
                <span className="orgKpiIcon amber">◷</span>
                <div>
                  <small>À prendre en charge</small>
                  <strong>{transfers.filter((item) => item.status === "pending").length}</strong>
                  <span>En attente de décision</span>
                </div>
              </article>
              <article className="orgKpiCard">
                <span className="orgKpiIcon green">♙</span>
                <div>
                  <small>Agents de l'agence</small>
                  <strong>{agents.length}</strong>
                  <span>Équipe opérationnelle</span>
                </div>
              </article>
            </>
          )}
        </section>
        {error && <div className="card error">{error}</div>}
        {membership?.role === "admin" && (
          <div className="card">
            <h2>Paramètres de l’organisation</h2>
            <p>
              Ajoutez le logo officiel de {membership.organization.name}. Il sera partagé avec les
              comptes centraux et les agences de cette organisation.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 16,
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  display: "grid",
                  placeItems: "center",
                  overflow: "hidden",
                }}
              >
                {organizationLogo ? (
                  <img
                    src={organizationLogo}
                    alt="Logo de l’organisation"
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  />
                ) : (
                  <span style={{ fontSize: 12, color: "#64748b" }}>Aucun logo</span>
                )}
              </div>
              <div>
                <p style={{ fontSize: 13 }}>JPG, PNG ou WEBP · 2 Mo maximum</p>
                <label
                  className="button"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    cursor: logoBusy ? "wait" : "pointer",
                  }}
                >
                  {logoBusy ? "Envoi…" : "Ajouter / remplacer le logo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={logoBusy}
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      setLogoBusy(true);
                      setError("");
                      try {
                        const url = await uploadOrganizationLogo(membership.organization_id, file);
                        setOrganizationLogo(url);
                      } catch (err) {
                        setError(
                          err instanceof Error ? err.message : "Impossible d’enregistrer le logo.",
                        );
                      } finally {
                        setLogoBusy(false);
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
        )}
        {central ? (
          <>
            <div className="card" id="org-transfers">
              <h2>Transmissions reçues</h2>
              {!transfers.length ? (
                <p>Aucune transmission en attente ou historique disponible.</p>
              ) : (
                transfers.map((t) => (
                  <article className="card" key={t.id}>
                    <strong>{t.reports?.reference_code ?? t.report_id}</strong>
                    <h3>{t.reports?.title ?? "Signalement transmis"}</h3>
                    {transferMedia.filter((media) => media.report_id === t.report_id).map((media) => (
                      <div key={media.id} style={{ marginTop: 10 }}>
                        {media.previewUrl ? (
                          media.media_type.startsWith("image/") ? (
                            <img src={media.previewUrl} alt="Photo du signalement" style={{ width: "100%", maxHeight: 280, objectFit: "contain", borderRadius: 10 }} />
                          ) : (
                            <video src={media.previewUrl} controls playsInline preload="metadata" style={{ width: "100%", maxHeight: 280, borderRadius: 10, background: "#111" }} />
                          )
                        ) : <p>Média indisponible pour le moment.</p>}
                      </div>
                    ))}
                    <p></p>
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
                      <div className="actions" style={{ display: "grid", gap: 8 }}>
                        <p>Transmission acceptée. Choisissez maintenant l'agence locale qui recevra la mission.</p>
                        <select
                          value={agencySelection[t.id] ?? ""}
                          onChange={(event) =>
                            setAgencySelection((current) => ({ ...current, [t.id]: event.target.value }))
                          }
                        >
                          <option value="">Choisir une agence locale…</option>
                          {units.map((unit) => (
                            <option key={unit.id} value={unit.id}>
                              {unit.name} — {unit.code}
                            </option>
                          ))}
                        </select>
                        <button
                          className="button primary"
                          disabled={busy || !agencySelection[t.id]}
                          onClick={() =>
                            act(() => assignOrganizationAgency(t.id, agencySelection[t.id]))
                          }
                        >
                          Attribuer à cette agence
                        </button>
                      </div>
                    )}
                    {t.status === "completed" && t.organization_unit_id && (
                      <p>
                        Mission transmise à l'agence :{" "}
                        <strong>
                          {units.find((unit) => unit.id === t.organization_unit_id)?.name ?? "Agence locale"}
                        </strong>
                      </p>
                    )}
                  </article>
                ))
              )}
            </div>
            <div className="card" id="org-resolution-review">
              <h2>Résolutions à valider</h2>
              <p>Examinez les preuves envoyées par les agents des agences. Le signalement ne devient résolu qu'après votre approbation.</p>
              {!resolutionMedia.length ? (
                <p>Aucune preuve de résolution en attente.</p>
              ) : resolutionMedia.map((item) => (
                <article className="card" key={item.id}>
                  <strong>{item.reports?.reference_code ?? item.report_id} · {item.reports?.title ?? "Signalement"}</strong>
                  {item.previewUrl ? (
                    item.media_type.startsWith("image/") ? (
                      <img src={item.previewUrl} alt="Preuve photo de résolution" style={{ width: "100%", maxHeight: 320, objectFit: "contain", borderRadius: 10, marginTop: 10 }} />
                    ) : (
                      <video src={item.previewUrl} controls playsInline preload="metadata" style={{ width: "100%", maxHeight: 320, borderRadius: 10, marginTop: 10, background: "#111" }} />
                    )
                  ) : <p>Prévisualisation indisponible. Actualisez pour réessayer.</p>}
                  <small>{item.file_size ? (item.file_size / 1024 / 1024).toFixed(1) + " Mo" : "Taille inconnue"}</small>
                  <div className="actions">
                    <button className="button primary" disabled={busy} onClick={() => void reviewResolutionMedia(item.id, true)}>Approuver la résolution</button>
                    <button className="button" disabled={busy} onClick={() => {
                      if (window.confirm("Rejeter cette preuve ? Le signalement restera en traitement et l'agence pourra demander une nouvelle intervention.")) void reviewResolutionMedia(item.id, false);
                    }}>Rejeter la résolution</button>
                  </div>
                </article>
              ))}
            </div>
            <div className="card" id="org-agencies">
              <h2>Agences</h2>
              {!units.length ? (
                <p>Aucune agence opérationnelle n'est encore créée.</p>
              ) : (
                units.map((u) => (
                  <div className="row" key={u.id}>
                    <strong>{u.name}</strong>
                    <span>{u.code}</span>
                  </div>
                ))
              )}
            </div>
            <div className="card" id="org-local-missions">
              <h2>Suivi des missions locales</h2>
              {!agencyMissions.length ? (
                <p>Aucune mission locale n'est encore enregistrée.</p>
              ) : (
                agencyMissions.map((m) => (
                  <div className="row" key={m.id}>
                    <div>
                      <strong>{m.reports?.reference_code ?? m.report_id}</strong>
                      <small>
                        {m.reports?.title ?? "Signalement"} · {m.unit?.name ?? "Agence locale"}
                      </small>
                    </div>
                    <span>{m.status}</span>
                  </div>
                ))
              )}
            </div>
            <div className="card" id="org-settings">
              <h2>Créer un compte d’agence</h2>
              <p>
                Chaque agence dispose de son propre accès. Son responsable crée et gère les comptes de ses agents terrain.
              </p>
              <div className="form">
                <label>
                  Nom de l’agence
                  <input
                    required
                    value={agencyForm.name}
                    onChange={(e) => setAgencyForm({ ...agencyForm, name: e.target.value })}
                    placeholder="Ex. NIGELEC Niamey 1"
                  />
                </label>
                <label>
                  Code unique de l’agence
                  <input
                    required
                    value={agencyForm.code}
                    onChange={(e) =>
                      setAgencyForm({
                        ...agencyForm,
                        code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""),
                      })
                    }
                    placeholder="Ex. NIG-NIAMEY-01"
                  />
                </label>
                <PasswordField
                  label="Mot de passe"
                  value={agencyForm.admin_password}
                  onChange={(value) => setAgencyForm({ ...agencyForm, admin_password: value })}
                  visible={showAgencyPassword}
                  onToggle={() => setShowAgencyPassword((value) => !value)}
                />
                <PasswordField
                  label="Confirmer le mot de passe"
                  value={agencyForm.confirm_password}
                  onChange={(value) => setAgencyForm({ ...agencyForm, confirm_password: value })}
                  confirmation
                  visible={showAgencyPassword}
                  onToggle={() => setShowAgencyPassword((value) => !value)}
                />
                {agencyForm.confirm_password.length > 0 &&
                  agencyForm.admin_password !== agencyForm.confirm_password && (
                    <p className="error">Les deux mots de passe ne correspondent pas.</p>
                  )}
                <button
                  className="button primary"
                  disabled={
                    busy ||
                    !agencyForm.name.trim() ||
                    !agencyForm.code.trim() ||
                    agencyForm.admin_password.length < 8 ||
                    agencyForm.admin_password !== agencyForm.confirm_password
                  }
                  onClick={() =>
                    act(async () => {
                      await createOrganizationAgency({
                        organization_id: membership.organization_id,
                        name: agencyForm.name,
                        code: agencyForm.code,
                        admin_password: agencyForm.admin_password,
                      });
                      setAgencyForm({
                        name: "",
                        code: "",
                        admin_password: "",
                        confirm_password: "",
                      });
                      setShowAgencyPassword(false);
                    })
                  }
                >
                  Créer l’agence et son compte
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="card" id="org-transfers">
              <h2>Transmissions de la mairie</h2>
              {transfers.filter((t) => t.status === "pending").length === 0 ? (
                <p>Aucune transmission locale en attente.</p>
              ) : (
                transfers
                  .filter((t) => t.status === "pending")
                  .map((t) => (
                    <article className="card" key={t.id}>
                      <strong>{t.reports?.reference_code ?? t.report_id}</strong>
                      <h3>{t.reports?.title ?? "Signalement transmis"}</h3>
                      <p></p>
                      <small>Statut : en attente de prise en charge</small>
                      <div className="actions">
                        <button
                          className="button primary"
                          disabled={busy}
                          onClick={() => act(() => acceptOrganizationTransfer(t.id))}
                        >
                          Accepter la mission
                        </button>
                        <button
                          className="button"
                          disabled={busy}
                          onClick={() =>
                            act(() =>
                              declineOrganizationTransfer(
                                t.id,
                                "Signalement non pris en charge par cette agence.",
                              ),
                            )
                          }
                        >
                          Refuser
                        </button>
                      </div>
                    </article>
                  ))
              )}
            </div>
            <div className="card" id="org-missions">
              <h2>{membership?.unit?.name}</h2>
              <p>Missions reçues : {missions.length}</p>
              {!missions.length ? (
                <p>Aucune mission attribuée.</p>
              ) : (
                missions.map((m) => (
                  <article className="card" key={m.id}>
                    <strong>{m.reports?.reference_code ?? m.report_id}</strong>
                    <h3>{m.reports?.title ?? "Mission"}</h3>
                    <p>{m.reports?.location_label ?? "Localisation GPS"}</p>
                    {transferMedia.filter((media) => media.report_id === m.report_id).map((media) => (
                      <div key={media.id} style={{ marginTop: 10 }}>
                        {media.previewUrl ? (
                          media.media_type.startsWith("image/") ? (
                            <img src={media.previewUrl} alt="Photo du signalement" style={{ width: "100%", maxHeight: 280, objectFit: "contain", borderRadius: 10 }} />
                          ) : (
                            <video src={media.previewUrl} controls playsInline preload="metadata" style={{ width: "100%", maxHeight: 280, borderRadius: 10, background: "#111" }} />
                          )
                        ) : <p>Média indisponible pour le moment.</p>}
                      </div>
                    ))}
                    <label>
                      Agent
                      <select
                        defaultValue=""
                        onChange={(e) =>
                          act(() => assignAgencyMissionToAgent(m.id, e.target.value))
                        }
                      >
                        <option value="">Affecter un agent…</option>
                        {agents.map((a) => (
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
            <div className="card" id="org-create-agent">
              <h2>Créer un agent terrain</h2>
              <p>Vous créez ici les comptes des agents rattachés à votre agence. Vous pourrez ensuite leur affecter les missions reçues.</p>
              <div className="form">
                <input placeholder="Prénom" value={agentForm.first_name} onChange={(event) => setAgentForm({ ...agentForm, first_name: event.target.value })} />
                <input placeholder="Nom" value={agentForm.last_name} onChange={(event) => setAgentForm({ ...agentForm, last_name: event.target.value })} />
                <input placeholder="Matricule" value={agentForm.matricule} onChange={(event) => setAgentForm({ ...agentForm, matricule: event.target.value })} />
                <input placeholder="Qualification" value={agentForm.qualification} onChange={(event) => setAgentForm({ ...agentForm, qualification: event.target.value })} />
                <input placeholder="Téléphone" value={agentForm.phone} onChange={(event) => setAgentForm({ ...agentForm, phone: event.target.value })} />
                <input type="password" minLength={8} placeholder="Mot de passe" value={agentForm.password} onChange={(event) => setAgentForm({ ...agentForm, password: event.target.value })} />
                <button
                  className="button primary"
                  disabled={busy || !agentForm.first_name.trim() || !agentForm.last_name.trim() || !agentForm.matricule.trim() || !agentForm.qualification.trim() || agentForm.password.length < 8}
                  onClick={() => act(async () => {
                    await createAgencyAgent({ ...agentForm, organization_unit_id: membership!.unit_id! });
                    setAgentForm({ first_name: "", last_name: "", matricule: "", qualification: "", phone: "", password: "" });
                  })}
                >
                  Créer l'agent terrain
                </button>
              </div>
            </div>
            <div className="card" id="org-active-agents">
              <h2>Agents actifs</h2>
              {!agents.length ? (
                <p>Aucun agent dans cette agence.</p>
              ) : (
                agents.map((a) => (
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
      </main>
    </section>
  );
}
