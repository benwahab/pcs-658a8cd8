import { useEffect, useState } from "react";
import { Link } from "@/pcs/router";
import {
  assignReport,
  listAllReports,
  listAssignableAgents,
  listDepartments,
  updateReportPriority,
  updateReportStatus,
  listOrganizationSignupRequests,
  approveOrganizationSignupRequest,
  rejectOrganizationSignupRequest,
  type OrganizationSignupRequest,
} from "../services/admin";
import { statusLabels, type ReportPriority, type ReportStatus } from "../types";

type Row = {
  id: string;
  reference_code: string;
  title: string;
  status: ReportStatus;
  priority: ReportPriority;
  created_at: string;
  department_id: string | null;
  categories?: { name: string } | null;
  departments?: { name: string } | null;
};
const nextStatuses: Record<ReportStatus, ReportStatus[]> = {
  submitted: ["received", "rejected"],
  received: ["verification", "rejected"],
  verification: ["in_progress", "rejected"],
  in_progress: ["resolved", "rejected"],
  resolved: ["in_progress"],
  rejected: ["received"],
};

export default function Admin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [orgRequests, setOrgRequests] = useState<OrganizationSignupRequest[]>([]);
  const [error, setError] = useState("");
  const [loadErrors, setLoadErrors] = useState<Record<string, string>>({});
  async function load() {
    const results = await Promise.allSettled([listAllReports(), listOrganizationSignupRequests()]);
    const nextErrors: Record<string, string> = {};
    const [reportsResult, orgResult] = results;
    if (reportsResult.status === "fulfilled") setRows(reportsResult.value as Row[]);
    else
      nextErrors.reports =
        reportsResult.reason instanceof Error
          ? reportsResult.reason.message
          : "Chargement des signalements impossible.";
    if (orgResult.status === "fulfilled") setOrgRequests(orgResult.value);
    else
      nextErrors.organizations =
        orgResult.reason instanceof Error
          ? orgResult.reason.message
          : "Chargement des demandes NIGELEC/NDE impossible.";
    setLoadErrors(nextErrors);
  }
  useEffect(() => {
    load();
    Promise.all([listDepartments(), listAssignableAgents()])
      .then(([d, a]) => {
        setDepartments(d);
        setAgents(a);
      })
      .catch((e) => setError(e.message));
  }, []);
  async function status(id: string, value: ReportStatus) {
    setError("");
    try {
      await updateReportStatus(id, value);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transition refusée.");
    }
  }
  async function priority(id: string, value: ReportPriority) {
    setError("");
    try {
      await updateReportPriority(id, value);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mise à jour impossible.");
    }
  }
  async function reviewOrg(id: string, approve: boolean) {
    setError("");
    try {
      if (approve) await approveOrganizationSignupRequest(id);
      else {
        const note = window.prompt("Motif du refus :");
        if (!note?.trim()) return;
        await rejectOrganizationSignupRequest(id, note);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Traitement de la demande impossible.");
    }
  }
  async function assign(id: string, value: string) {
    if (!value) return;
    const parts = value.split("|");
    const departmentId = parts[0];
    const agentId = parts[1] || null;
    setError("");
    try {
      await assignReport(id, departmentId, agentId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Attribution impossible.");
    }
  }
  return (
    <section>
      <div className="sectionHead">
        <div>
          <p className="eyebrow">ESPACE OPÉRATIONNEL</p>
          <h1>Traitement des signalements</h1>
        </div>
        <Link className="button" to="/dashboard">
          Tableau de bord
        </Link>
      </div>
      {error && <div className="card error">{error}</div>}
      <div className="card">
        <h2>Demandes d’accès NIGELEC / NDE</h2>
        <p>
          Les comptes créés par les professionnels restent sans accès organisationnel jusqu’à
          validation.
        </p>
        {loadErrors.organizations ? (
          <div className="card error">
            Impossible de charger les demandes NIGELEC/NDE : {loadErrors.organizations}
          </div>
        ) : !orgRequests.length ? (
          <div className="empty">Aucune demande.</div>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Organisation</th>
                  <th>Structure locale</th>
                  <th>Région / localité</th>
                  <th>Responsable</th>
                  <th>Email / téléphone</th>
                  <th>Statut</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {orgRequests.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.organization_name}</strong>
                      <br />
                      <small>{r.organization_code}</small>
                    </td>
                    <td>{r.structure_name || "—"}</td>
                    <td>
                      {r.region_name || "—"}
                      <br />
                      <small>{r.commune_name || "Localité non renseignée"}</small>
                    </td>
                    <td>{r.full_name}</td>
                    <td>
                      {r.email}
                      {r.phone && (
                        <>
                          <br />
                          <small>{r.phone}</small>
                        </>
                      )}
                    </td>
                    <td>
                      <span className="badge">
                        {r.status === "pending"
                          ? "En attente"
                          : r.status === "approved"
                            ? "Approuvée"
                            : "Refusée"}
                      </span>
                    </td>
                    <td>{new Date(r.created_at).toLocaleDateString("fr-FR")}</td>
                    <td>
                      {r.status === "pending" ? (
                        <div className="actions">
                          <button className="button primary" onClick={() => reviewOrg(r.id, true)}>
                            Approuver
                          </button>
                          <button className="button" onClick={() => reviewOrg(r.id, false)}>
                            Refuser
                          </button>
                        </div>
                      ) : (
                        r.review_note || "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="tableWrap card">
        <table>
          <thead>
            <tr>
              <th>Référence</th>
              <th>Signalement</th>
              <th>Catégorie</th>
              <th>Attribution</th>
              <th>Priorité</th>
              <th>Statut</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link to={"/signalement/" + r.id}>
                    <strong>{r.reference_code}</strong>
                  </Link>
                </td>
                <td>
                  {r.title}
                  <br />
                  <small>{new Date(r.created_at).toLocaleDateString("fr-FR")}</small>
                </td>
                <td>{r.categories?.name ?? "—"}</td>
                <td>
                  <select value="" onChange={(e) => assign(r.id, e.target.value)}>
                    <option value="">{r.departments?.name ?? "Affecter…"}</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id + "|"}>
                        {d.name}
                      </option>
                    ))}
                    {agents.map((a) => (
                      <option
                        key={a.user_id}
                        value={(r.department_id ?? departments[0]?.id ?? "") + "|" + a.user_id}
                      >
                        Agent {a.user_id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    value={r.priority}
                    onChange={(e) => priority(r.id, e.target.value as ReportPriority)}
                  >
                    <option value="low">Faible</option>
                    <option value="normal">Normale</option>
                    <option value="high">Haute</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </td>
                <td>
                  <span className="badge">{statusLabels[r.status]}</span>
                </td>
                <td>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) status(r.id, e.target.value as ReportStatus);
                    }}
                  >
                    <option value="">Changer…</option>
                    {nextStatuses[r.status].map((s) => (
                      <option key={s} value={s}>
                        {statusLabels[s]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loadErrors.reports ? (
          <div className="empty error">
            Impossible de charger les signalements : {loadErrors.reports}
          </div>
        ) : (
          !rows.length && !error && <div className="empty">Aucun signalement accessible.</div>
        )}
      </div>
    </section>
  );
}
