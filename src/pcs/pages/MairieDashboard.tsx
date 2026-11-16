import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "@/pcs/router";
import { supabase } from "../lib/supabase";
import type { Tables } from "@/integrations/supabase/types";
import {
  getMyMairie,
  listMairieReports,
  listMyAgents,
  listMairieTransmissionTargets,
  transmitReportToOrganization,
  assignMission,
  createFieldAgent,
  resetFieldAgentPassword,
  updateMairieProfile,
  uploadMairieLogo,
  type FieldAgentRow,
  type MairieRecord,
  type MairieReport,
  type MairieTransmissionTarget,
} from "../services/mairie";
import { statusLabels } from "../types";
import BrandLogo from "../components/BrandLogo";
import { downloadAgentCredentialPdf } from "../utils/agentCredentialPdf";

// Resolution video awaiting review, with a short-lived preview link added client-side.
type ResolutionVideo = Pick<
  Tables<"report_media">,
  "id" | "report_id" | "storage_path" | "media_type" | "file_size" | "created_at"
> & {
  reports: Pick<Tables<"reports">, "reference_code" | "title" | "commune_id"> | null;
  previewUrl: string | null;
};

const statusMeta: Record<string, { label: string; tone: string }> = {
  submitted: { label: "Envoyé", tone: "blue" },
  received: { label: "Reçu", tone: "slate" },
  verification: { label: "Vérification", tone: "amber" },
  in_progress: { label: "En traitement", tone: "violet" },
  resolved: { label: "Résolu", tone: "violet" },
  rejected: { label: "Rejeté", tone: "red" },
};
function formatDate(v: string) {
  return new Date(v).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
function mapsUrl(r: { latitude?: number | null; longitude?: number | null }) {
  return typeof r.latitude === "number" && typeof r.longitude === "number"
    ? `https://www.google.com/maps/search/?api=1&query=${r.latitude},${r.longitude}`
    : "#";
}

export default function MairieDashboard() {
  const nav = useNavigate();
  const [m, setM] = useState<MairieRecord | null>(null),
    [rows, setRows] = useState<MairieReport[]>([]),
    [agents, setAgents] = useState<FieldAgentRow[]>([]),
    [transmissionTargets, setTransmissionTargets] = useState<MairieTransmissionTarget[]>([]),
    [resolutionVideos, setResolutionVideos] = useState<ResolutionVideo[]>([]),
    [resolutionError, setResolutionError] = useState(""),
    [reviewBusy, setReviewBusy] = useState<string | null>(null);
  const [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [busyAgent, setBusyAgent] = useState(false),
    [busyMayor, setBusyMayor] = useState(false),
    [busyTransmit, setBusyTransmit] = useState(false),
    [mayorName, setMayorName] = useState(""),
    [transmitOrg, setTransmitOrg] = useState<Record<string, string>>({}),
    [mairieLogo, setMairieLogo] = useState(""),
    [logoBusy, setLogoBusy] = useState(false);
  const [newAgent, setNewAgent] = useState({
    first_name: "",
    last_name: "",
    matricule: "",
    qualification: "",
    phone: "",
    password: "",
  });
  const [confirmPassword, setConfirmPassword] = useState(""),
    [showPassword, setShowPassword] = useState(false),
    [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetAgentId, setResetAgentId] = useState(""),
    [resetPassword, setResetPassword] = useState(""),
    [confirmResetPassword, setConfirmResetPassword] = useState(""),
    [busyReset, setBusyReset] = useState(false);
  async function load() {
    try {
      const [a, b, c, d] = await Promise.all([
        getMyMairie(),
        listMairieReports(),
        listMyAgents(),
        listMairieTransmissionTargets(),
      ]);
      if (!a) {
        await supabase?.auth.signOut();
        nav("/connexion-operationnelle");
        return;
      }
      setM(a);
      setMayorName(a?.mayor_name ?? "");
      setMairieLogo(a?.logo_url ?? "");
      setRows(b);
      setAgents(c);
      setTransmissionTargets(d);
    } catch (e) {
      console.error("[PCS][MairieDashboard] Échec du chargement principal :", e);
      setError(e instanceof Error ? e.message : "Erreur de chargement");
      return;
    }
    if (!supabase) return;
    try {
      const { data: media, error: mediaError } = await supabase
        .from("report_media")
        .select(
          "id,report_id,storage_path,media_type,file_size,created_at,reports!inner(reference_code,title,commune_id)",
        )
        .eq("media_role", "resolution_video")
        .eq("moderation_status", "pending")
        .order("created_at", { ascending: false });
      if (mediaError) throw mediaError;
      const withUrls = await Promise.all(
        (media ?? []).map(async (item) => {
          const { data, error } = await supabase!.storage
            .from("report-media")
            .createSignedUrl(item.storage_path, 900);
          if (error)
            console.error("[PCS][MairieDashboard] URL vidéo indisponible :", item.id, error);
          return { ...item, previewUrl: data?.signedUrl ?? null };
        }),
      );
      setResolutionVideos(withUrls);
      setResolutionError("");
    } catch (e) {
      console.error("[PCS][MairieDashboard] Échec du chargement des vidéos de résolution :", e);
      setResolutionError(
        "Impossible de charger les vidéos de résolution pour le moment. Les autres données du tableau de bord restent disponibles.",
      );
    }
  }
  async function reviewResolutionVideo(item: ResolutionVideo, approve: boolean) {
    if (!supabase) return;
    setError("");
    setSuccess("");
    setReviewBusy(item.id);
    try {
      const { error: reviewError } = await supabase.rpc("mairie_review_resolution_video", {
        p_media_id: item.id,
        p_approve: approve,
      });
      if (reviewError) throw reviewError;
      if (!approve) {
        setSuccess("La résolution a été rejetée. Le signalement reste en traitement et l'agent pourra transmettre une nouvelle preuve.");
      } else {
        setSuccess("La résolution a été approuvée. Le signalement est maintenant officiellement résolu.");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de traiter cette vidéo.");
    } finally {
      setReviewBusy(null);
    }
  }
  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (active && document.visibilityState === "visible") void load();
    };
    void load();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- abonnements et minuterie installés une seule fois au montage
  }, []);
  async function createAgent() {
    setError("");
    setSuccess("");
    if (newAgent.password !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setBusyAgent(true);
    try {
      const initialPassword = newAgent.password;
      const createdAgent = await createFieldAgent(newAgent);
      try {
        downloadAgentCredentialPdf(
          { ...createdAgent, phone: createdAgent.phone || newAgent.phone },
          m,
          initialPassword,
        );
        setSuccess(
          "Le compte agent a été créé. Sa fiche PDF contenant ses informations et ses identifiants a été téléchargée. Remettez-la directement à l’agent.",
        );
      } catch (pdfError) {
        console.error(
          "[PCS][MairieDashboard] Échec du téléchargement de la fiche agent :",
          pdfError,
        );
        setSuccess(
          "Le compte agent a été créé, mais le téléchargement de la fiche PDF a échoué. Téléchargez-la depuis cette fenêtre avant de fermer la page.",
        );
      }
      setNewAgent({
        first_name: "",
        last_name: "",
        matricule: "",
        qualification: "",
        phone: "",
        password: "",
      });
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Création impossible");
    } finally {
      setBusyAgent(false);
    }
  }
  async function resetAgentPassword() {
    setError("");
    setSuccess("");
    if (!resetAgentId) return;
    if (resetPassword !== confirmResetPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setBusyReset(true);
    try {
      await resetFieldAgentPassword(resetAgentId, resetPassword);
      setResetAgentId("");
      setResetPassword("");
      setConfirmResetPassword("");
      setSuccess(
        "Le mot de passe de l’agent a été réinitialisé. Communiquez-lui son nouveau mot de passe de manière sécurisée.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Réinitialisation impossible.");
    } finally {
      setBusyReset(false);
    }
  }
  async function assign(r: string, a: string) {
    if (!a) return;
    setError("");
    try {
      await assignMission(r, a);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Affectation impossible");
    }
  }
  async function transmit(r: string) {
    const target = transmitOrg[r];
    if (!target) return;
    const [organizationId, organizationUnitId] = target.split(":");
    if (!organizationId || !organizationUnitId) return;
    setError("");
    setSuccess("");
    setBusyTransmit(true);
    try {
      await transmitReportToOrganization(r, organizationId, organizationUnitId);
      setTransmitOrg((v) => ({ ...v, [r]: "" }));
      await load();
      setSuccess("Le signalement a été transmis à l’organisation.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transmission impossible");
    } finally {
      setBusyTransmit(false);
    }
  }
  async function logout() {
    await supabase?.auth.signOut();
    nav("/");
  }
  const stats = useMemo(
    () => ({
      total: rows.length,
      verification: rows.filter((r) => r.status === "verification").length,
      inProgress: rows.filter((r) => r.status === "in_progress").length,
      resolved: rows.filter((r) => r.status === "resolved").length,
      received: rows.filter((r) => r.status === "received" || r.status === "submitted").length,
    }),
    [rows],
  );
  const progress = stats.total ? Math.round((stats.resolved / stats.total) * 100) : 0;
  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const q = query.trim().toLowerCase();
        const matches =
          !q ||
          [r.reference_code, r.title, r.location_label, r.categories?.name]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q);
        return matches && (filter === "all" || r.status === filter);
      }),
    [rows, query, filter],
  );
  const activeAgents = agents.filter((a) => a.is_active),
    verificationRows = rows.filter((r) => r.status === "verification").slice(0, 5);
  return (
    <div className="mairieDashboard">
      <aside className="mairieSidebar">
        <div className="mairieBrand">
          <BrandLogo className="mairieBrandLogo" />
          <div>
            <strong>PCS</strong>
            <small>Administration</small>
          </div>
        </div>
        <div className="mairieMenuLabel">MENU</div>
        <nav className="mairieNav">
          <a className="active" href="#dashboard">
            <span>⌂</span>Tableau de bord
          </a>
          <a href="#signalements">
            <span>▣</span>Signalements <b>{stats.total}</b>
          </a>
          <a href="#agents">
            <span>♙</span>Agents terrain <b>{activeAgents.length}</b>
          </a>
          <a href="#statistiques">
            <span>◔</span>Statistiques
          </a>
          <a href="#notifications">
            <span>◌</span>Notifications
          </a>
        </nav>
        <div className="mairieMenuLabel">SYSTÈME</div>
        <nav className="mairieNav mairieNavBottom">
          <a href="#parametres">
            <span>⚙</span>Paramètres
          </a>
          <a href="#aide">
            <span>?</span>Aide
          </a>
          <button onClick={logout}>
            <span>↪</span>Déconnexion
          </button>
        </nav>
        <div className="mairieSidebarFooter">
          <strong>{m?.name ?? "Mairie"}</strong>
          <span>{m?.regions?.name ?? "Région non configurée"}</span>
        </div>
      </aside>
      <main className="mairieMain" id="dashboard">
        <header className="mairieTopbar">
          <div className="mairieSearch">
            <span>⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un signalement..."
            />
          </div>
          <div className="mairieTopActions">
            <button
              className="iconButton"
              title="Notifications"
              onClick={() =>
                document.getElementById("notifications")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              ♧
            </button>
            <button className="iconButton" title="Actualiser" onClick={load}>
              ↻
            </button>
            <div className="mairieProfile">
              <span className="profileAvatar">{(m?.name ?? "M").slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{m?.name ?? "Mairie"}</strong>
                <small>{m?.regions?.name ?? "Région"}</small>
              </div>
            </div>
          </div>
        </header>
        <section className="mairieContent">
          <div className="mairieWelcome">
            <div>
              <p className="eyebrow">ESPACE MAIRIE · {m?.regions?.name ?? "RÉGION"}</p>
              <h1>Tableau de bord</h1>
              <p>Suivez, affectez et contrôlez les signalements de votre région.</p>
            </div>
            <div className="mairieWelcomeActions">
              <button
                className="mairieButton secondary"
                type="button"
                onClick={() => window.history.back()}
              >
                Retour
              </button>
              <a className="mairieButton primary" href="#signalements">
                Voir les signalements
              </a>
            </div>
          </div>
          {error && (
            <div className="mairieAlert" role="alert">
              {error}
              <button onClick={() => setError("")}>×</button>
            </div>
          )}
          {success && (
            <div className="mairieAlert mairieSuccess" role="status">
              {success}
              <button onClick={() => setSuccess("")}>×</button>
            </div>
          )}
          <section className="mairieStats">
            <article className="mairieStatCard featured">
              <div className="statIcon">▣</div>
              <span>Total signalements</span>
              <strong>{stats.total}</strong>
              <small>Dans votre région</small>
            </article>
            <article className="mairieStatCard">
              <div className="statIcon amber">!</div>
              <span>À vérifier</span>
              <strong>{stats.verification}</strong>
              <small>En attente d'agent</small>
            </article>
            <article className="mairieStatCard">
              <div className="statIcon violet">↗</div>
              <span>En traitement</span>
              <strong>{stats.inProgress}</strong>
              <small>Missions en cours</small>
            </article>
            <article className="mairieStatCard">
              <div className="statIcon green">✓</div>
              <span>Résolus</span>
              <strong>{stats.resolved}</strong>
              <small>Traitement terminé</small>
            </article>
          </section>
          <section className="mairieTopGrid">
            <article className="mairiePanel mairieChartPanel" id="statistiques">
              <div className="panelHead">
                <div>
                  <h2>Répartition des signalements</h2>
                  <p>État actuel des dossiers de la région</p>
                </div>
                <span className="panelPeriod">Actualisé à l'instant</span>
              </div>
              <div className="statusBars">
                {(["verification", "in_progress", "resolved", "received"] as const).map((k) => {
                  const value =
                    k === "verification"
                      ? stats.verification
                      : k === "in_progress"
                        ? stats.inProgress
                        : k === "resolved"
                          ? stats.resolved
                          : stats.received;
                  const width = stats.total
                    ? Math.max(value ? 6 : 0, Math.round((value / stats.total) * 100))
                    : 0;
                  return (
                    <div className="statusBarRow" key={k}>
                      <div>
                        <span className={`dot ${statusMeta[k].tone}`}></span>
                        {statusMeta[k].label}
                        <b>{value}</b>
                      </div>
                      <div className="statusBar">
                        <i className={statusMeta[k].tone} style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
            <article className="mairiePanel progressPanel">
              <div className="panelHead">
                <div>
                  <h2>Progression</h2>
                  <p>Signalements résolus</p>
                </div>
              </div>
              <div
                className="progressRing"
                style={{ "--progress": `${progress * 3.6}deg` } as CSSProperties}
              >
                <div>
                  <strong>{progress}%</strong>
                  <span>Résolus</span>
                </div>
              </div>
              <div className="progressLegend">
                <span>
                  <i className="dot green"></i>Résolus <b>{stats.resolved}</b>
                </span>
                <span>
                  <i className="dot slate"></i>Restants{" "}
                  <b>{Math.max(0, stats.total - stats.resolved)}</b>
                </span>
              </div>
            </article>
          </section>
          <section className="mairieMiddleGrid">
            <article className="mairiePanel">
              <div className="panelHead">
                <div>
                  <h2>À traiter maintenant</h2>
                  <p>Signalements nécessitant une affectation terrain</p>
                </div>
                <a
                  href="#signalements"
                  onClick={(e) => {
                    e.preventDefault();
                    setFilter("verification");
                  }}
                >
                  Voir tout
                </a>
              </div>
              {verificationRows.length ? (
                <div className="priorityList">
                  {verificationRows.map((r) => (
                    <div className="priorityItem" key={r.id}>
                      <div className="priorityMarker amber"></div>
                      <div className="priorityBody">
                        <strong>{r.title}</strong>
                        <span>
                          {r.reference_code} · {r.location_label ?? "Localisation GPS enregistrée"}
                        </span>
                      </div>
                      <Link to={"/signalement/" + r.id}>Ouvrir</Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mairieEmpty compact">
                  Aucun signalement en attente de vérification.
                </div>
              )}
            </article>
            <article className="mairiePanel" id="agents">
              <div className="panelHead">
                <div>
                  <h2>Agents terrain</h2>
                  <p>{activeAgents.length} agent(s) actif(s)</p>
                </div>
                <a href="#create-agent">Ajouter</a>
              </div>
              <div className="agentList">
                {activeAgents.map((a) => (
                  <div className="agentItem agentItemManage" key={a.id}>
                    <span className="agentAvatar">
                      {`${a.first_name ?? ""} ${a.last_name ?? ""}`
                        .trim()
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                    <div>
                      <strong>
                        {a.first_name} {a.last_name}
                      </strong>
                      <span>
                        {a.qualification || "Agent terrain"} · {a.matricule} · {a.phone}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="agentPasswordAction"
                      onClick={() => {
                        setResetAgentId(resetAgentId === a.id ? "" : a.id);
                        setResetPassword("");
                        setConfirmResetPassword("");
                        setError("");
                        setSuccess("");
                      }}
                    >
                      {resetAgentId === a.id ? "Fermer" : "Réinitialiser"}
                    </button>
                  </div>
                ))}
                {!activeAgents.length && (
                  <div className="mairieEmpty compact">Aucun agent actif.</div>
                )}
              </div>
              {resetAgentId && (
                <div className="agentResetPanel">
                  <strong>Définir un nouveau mot de passe</strong>
                  <p>
                    La mairie contrôle entièrement l’accès de cet agent. Aucun SMS ni e-mail ne sera
                    envoyé.
                  </p>
                  <div className="agentResetFields">
                    <input
                      type="password"
                      minLength={8}
                      maxLength={128}
                      autoComplete="new-password"
                      placeholder="Nouveau mot de passe (8 caractères min.)"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                    />
                    <input
                      type="password"
                      minLength={8}
                      maxLength={128}
                      autoComplete="new-password"
                      placeholder="Confirmer le nouveau mot de passe"
                      value={confirmResetPassword}
                      onChange={(e) => setConfirmResetPassword(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="mairieButton primary"
                    disabled={
                      busyReset ||
                      resetPassword.length < 8 ||
                      resetPassword !== confirmResetPassword
                    }
                    onClick={resetAgentPassword}
                  >
                    {busyReset ? "Réinitialisation…" : "Enregistrer le nouveau mot de passe"}
                  </button>
                </div>
              )}
            </article>
          </section>
          <section className="mairiePanel" id="videos-resolution">
            <div className="panelHead">
              <div>
                <h2>Preuves de résolution à examiner</h2>
                <p>
                  Les photos et vidéos envoyées par les agents de cette mairie attendent votre décision. Le signalement ne sera clôturé qu'après votre approbation.
                </p>
              </div>
              <span className="statusPill amber">{resolutionVideos.length} en attente</span>
            </div>
            {resolutionError && (
              <div className="mairieAlert" role="alert">
                {resolutionError}
              </div>
            )}
            {resolutionVideos.length === 0 ? (
              <div className="mairieEmpty">Aucune preuve de résolution en attente.</div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))",
                  gap: 16,
                }}
              >
                {resolutionVideos.map((item) => (
                  <article
                    key={item.id}
                    style={{
                      border: "1px solid var(--border, #e5e7eb)",
                      borderRadius: 12,
                      padding: 12,
                      minWidth: 0,
                    }}
                  >
                    <strong>
                      {item.reports?.reference_code ?? "Signalement"} ·{" "}
                      {item.reports?.title ?? "Preuve de résolution"}
                    </strong>
                    {item.previewUrl ? (
                      item.media_type.startsWith("image/") ? (
                        <img
                          src={item.previewUrl}
                          alt="Preuve photo de résolution"
                          style={{ width: "100%", maxHeight: 300, objectFit: "contain", marginTop: 10, borderRadius: 8 }}
                        />
                      ) : (
                        <video
                          src={item.previewUrl}
                          controls
                          playsInline
                          preload="metadata"
                          style={{
                            width: "100%",
                            maxHeight: 300,
                            marginTop: 10,
                            borderRadius: 8,
                            background: "#111",
                          }}
                        />
                      )
                    ) : (
                      <p>Prévisualisation indisponible. Actualisez pour réessayer.</p>
                    )}
                    <p style={{ fontSize: 13, color: "var(--muted-foreground, #64748b)" }}>
                      Taille : {((item.file_size ?? 0) / 1024 / 1024).toFixed(1)} Mo ·{" "}
                      {formatDate(item.created_at)}
                    </p>
                    <div
                      className="tableActions"
                      style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                    >
                      <button
                        className="mairieButton primary"
                        disabled={reviewBusy === item.id}
                        onClick={() => reviewResolutionVideo(item, true)}
                      >
                        {reviewBusy === item.id ? "Traitement…" : "Approuver la résolution"}
                      </button>
                      <button
                        className="mairieButton secondary"
                        disabled={reviewBusy === item.id}
                        onClick={() => {
                          if (window.confirm("Rejeter cette preuve de résolution ? Le signalement restera en traitement."))
                            void reviewResolutionVideo(item, false);
                        }}
                      >
                        Rejeter la résolution
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
          <section className="mairiePanel reportPanel" id="signalements">
            <div className="panelHead reportPanelHead">
              <div>
                <h2>Signalements récents</h2>
                <p>Vue opérationnelle des dossiers de la région</p>
              </div>
              <div className="filterPills">
                {[
                  ["all", "Tous"],
                  ["verification", "À vérifier"],
                  ["in_progress", "En traitement"],
                  ["resolved", "Résolus"],
                ].map(([v, l]) => (
                  <button
                    key={v}
                    className={filter === v ? "selected" : ""}
                    onClick={() => setFilter(v)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="tableWrap mairieTableWrap">
              <table className="mairieTable">
                <thead>
                  <tr>
                    <th>Signalement</th>
                    <th>Localisation</th>
                    <th>Statut</th>
                    <th>Affectation</th>
                    <th>Transmission</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 10).map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div className="reportCell">
                          <strong>{r.reference_code}</strong>
                          <span>{r.title}</span>
                          <small>{r.categories?.name ?? "Catégorie"}</small>
                        </div>
                      </td>
                      <td>
                        {r.location_label ?? "Position GPS"}
                        <br />
                        <small>{formatDate(r.created_at)}</small>
                      </td>
                      <td>
                        <span className={`statusPill ${statusMeta[r.status]?.tone ?? "slate"}`}>
                          {statusLabels[r.status as keyof typeof statusLabels] ?? r.status}
                        </span>
                      </td>
                      <td>
                        <select
                          className="agentSelect"
                          defaultValue=""
                          disabled={["resolved", "in_progress", "verification"].includes(r.status)}
                          onChange={(e) => assign(r.id, e.target.value)}
                        >
                          <option value="">Affecter...</option>
                          {activeAgents.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.first_name} {a.last_name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div className="mairieTransmission">
                          <label className="mairieTransmissionLabel" htmlFor={`transmit-${r.id}`}>
                            DESTINATAIRE
                          </label>
                          <select
                            id={`transmit-${r.id}`}
                            className="mairieTransmissionSelect"
                            aria-label={`Choisir NIGELEC ou NDE pour le signalement ${r.reference_code}`}
                            value={transmitOrg[r.id] ?? ""}
                            disabled={
                              busyTransmit ||
                              r.status === "resolved" ||
                              r.status === "rejected" ||
                              !transmissionTargets.length
                            }
                            onChange={(e) =>
                              setTransmitOrg((v) => ({ ...v, [r.id]: e.target.value }))
                            }
                          >
                            <option value="">
                              {transmissionTargets.length
                                ? "Choisir la centrale NIGELEC ou NDE…"
                                : "Aucune centrale NIGELEC ou NDE configurée"}
                            </option>
                            {transmissionTargets.map((o) => (
                              <option
                                key={`${o.organization_id}:${o.organization_unit_id}`}
                                value={`${o.organization_id}:${o.organization_unit_id}`}
                              >
                                {o.organization_name} — {o.organization_unit_name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="mairieButton mairieTransmitButton"
                            aria-label={`Transmettre le signalement ${r.reference_code}`}
                            disabled={
                              busyTransmit ||
                              !transmitOrg[r.id] ||
                              r.status === "resolved" ||
                              r.status === "rejected"
                            }
                            onClick={() => transmit(r.id)}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              width="17"
                              height="17"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="m22 2-7 20-4-9-9-4Z" />
                              <path d="M22 2 11 13" />
                            </svg>
                            <span>
                              {busyTransmit
                                ? "Transmission en cours…"
                                : "Transmettre le signalement"}
                            </span>
                          </button>
                        </div>
                      </td>
                      <td>
                        <div className="tableActions">
                          <Link to={"/signalement/" + r.id}>Voir</Link>
                          {r.latitude && r.longitude && (
                            <a href={mapsUrl(r)} target="_blank" rel="noreferrer">
                              Carte
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filtered.length && (
              <div className="mairieEmpty">Aucun signalement ne correspond aux critères.</div>
            )}
          </section>
          <section className="mairiePanel" id="parametres">
            <div className="panelHead">
              <div>
                <h2>Paramètres de la mairie</h2>
                <p>Personnalisez l’identité de votre espace professionnel.</p>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
                marginBottom: 22,
              }}
            >
              <div
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 16,
                  border: "1px solid var(--border, #e5e7eb)",
                  background: "#fff",
                  display: "grid",
                  placeItems: "center",
                  overflow: "hidden",
                }}
              >
                {mairieLogo ? (
                  <img
                    src={mairieLogo}
                    alt="Logo de la mairie"
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  />
                ) : (
                  <span style={{ fontSize: 12, color: "#64748b" }}>Aucun logo</span>
                )}
              </div>
              <div>
                <strong>Logo officiel de la mairie</strong>
                <p style={{ margin: "5px 0", fontSize: 13 }}>JPG, PNG ou WEBP · 2 Mo maximum</p>
                <label
                  className="mairieButton secondary"
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
                      setSuccess("");
                      try {
                        const url = await uploadMairieLogo(file);
                        setMairieLogo(url);
                        setSuccess("Le logo de la mairie a été enregistré.");
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
            <div className="panelHead" id="profil-mairie">
              <div>
                <h2>Profil de la mairie</h2>
                <p>
                  Le compte appartient à la région. Le nom du maire peut être actualisé sans recréer
                  la mairie.
                </p>
              </div>
            </div>
            <div className="agentFormGrid">
              <input value={m?.name ?? ""} disabled placeholder="Nom de la mairie" />
              <input value={m?.regions?.name ?? ""} disabled placeholder="Région" />
              <input
                value={mayorName}
                onChange={(e) => setMayorName(e.target.value)}
                placeholder="Nom du maire"
              />
            </div>
            <button
              className="mairieButton primary"
              disabled={busyMayor || !mayorName.trim()}
              onClick={async () => {
                setBusyMayor(true);
                setError("");
                setSuccess("");
                try {
                  await updateMairieProfile({ mayor_name: mayorName });
                  await load();
                  setSuccess("Le nom du maire a été enregistré.");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Mise à jour impossible");
                } finally {
                  setBusyMayor(false);
                }
              }}
            >
              {busyMayor ? "Enregistrement..." : "Enregistrer le maire"}
            </button>
          </section>
          <section className="mairieBottomGrid">
            <article className="mairiePanel" id="create-agent">
              <div className="panelHead">
                <div>
                  <h2>Créer un agent terrain</h2>
                  <p>L'agent se connecte avec son numéro de téléphone.</p>
                </div>
              </div>
              <div className="agentFormGrid">
                <input
                  placeholder="Prénom"
                  value={newAgent.first_name}
                  onChange={(e) => setNewAgent({ ...newAgent, first_name: e.target.value })}
                />
                <input
                  placeholder="Nom"
                  value={newAgent.last_name}
                  onChange={(e) => setNewAgent({ ...newAgent, last_name: e.target.value })}
                />
                <input
                  placeholder="Matricule"
                  value={newAgent.matricule}
                  onChange={(e) => setNewAgent({ ...newAgent, matricule: e.target.value })}
                />
                <input
                  placeholder="Qualité / métier"
                  value={newAgent.qualification}
                  onChange={(e) => setNewAgent({ ...newAgent, qualification: e.target.value })}
                />
                <input
                  required
                  placeholder="Téléphone *"
                  value={newAgent.phone}
                  onChange={(e) => setNewAgent({ ...newAgent, phone: e.target.value })}
                />
                <div style={{ position: "relative", minWidth: 0 }}>
                  <input
                    required
                    minLength={8}
                    type={showPassword ? "text" : "password"}
                    placeholder="Mot de passe * (8 caractères min.)"
                    value={newAgent.password}
                    onChange={(e) => setNewAgent({ ...newAgent, password: e.target.value })}
                    autoComplete="new-password"
                    style={{ width: "100%", boxSizing: "border-box", paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    aria-label={
                      showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"
                    }
                    title={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    onClick={() => setShowPassword((v) => !v)}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      border: 0,
                      background: "transparent",
                      padding: 6,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "inherit",
                    }}
                  >
                    <svg
                      width="19"
                      height="19"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      {showPassword ? (
                        <>
                          <path d="M3 3l18 18" />
                          <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                          <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.5 9.5 7-.4 1-1.2 2.2-2.4 3.3" />
                          <path d="M6.2 6.2C3.9 7.7 2.7 10 2.5 12c.5 1.4 4 7 9.5 7 1.2 0 2.3-.2 3.3-.7" />
                        </>
                      ) : (
                        <>
                          <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>
                <div style={{ position: "relative", minWidth: 0 }}>
                  <input
                    required
                    minLength={8}
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirmer le mot de passe *"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    aria-invalid={Boolean(confirmPassword && confirmPassword !== newAgent.password)}
                    style={{ width: "100%", boxSizing: "border-box", paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    aria-label={
                      showConfirmPassword
                        ? "Masquer la confirmation du mot de passe"
                        : "Afficher la confirmation du mot de passe"
                    }
                    title={
                      showConfirmPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"
                    }
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      border: 0,
                      background: "transparent",
                      padding: 6,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "inherit",
                    }}
                  >
                    <svg
                      width="19"
                      height="19"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      {showConfirmPassword ? (
                        <>
                          <path d="M3 3l18 18" />
                          <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                          <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.5 9.5 7-.4 1-1.2 2.2-2.4 3.3" />
                          <path d="M6.2 6.2C3.9 7.7 2.7 10 2.5 12c.5 1.4 4 7 9.5 7 1.2 0 2.3-.2 3.3-.7" />
                        </>
                      ) : (
                        <>
                          <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </>
                      )}
                    </svg>
                  </button>
                  {confirmPassword && confirmPassword !== newAgent.password && (
                    <small
                      style={{
                        gridColumn: "1 / -1",
                        color: "var(--destructive, #dc2626)",
                        fontSize: 12,
                        display: "block",
                        marginTop: 4,
                      }}
                    >
                      Les mots de passe ne correspondent pas.
                    </small>
                  )}
                </div>
              </div>
              <button
                className="mairieButton primary"
                disabled={
                  busyAgent ||
                  !newAgent.phone.trim() ||
                  newAgent.password.length < 8 ||
                  newAgent.password !== confirmPassword ||
                  !newAgent.first_name.trim() ||
                  !newAgent.last_name.trim() ||
                  !newAgent.matricule.trim() ||
                  !newAgent.qualification.trim()
                }
                onClick={createAgent}
              >
                {busyAgent ? "Création..." : "Créer le compte agent"}
              </button>
            </article>
            <article className="mairiePanel" id="notifications">
              <div className="panelHead">
                <div>
                  <h2>Contrôle rapide</h2>
                  <p>Points d'attention opérationnels</p>
                </div>
              </div>
              <div className="quickChecks">
                <div>
                  <span className="quickIcon amber">!</span>
                  <div>
                    <strong>{stats.verification} vérification(s)</strong>
                    <small>À affecter à un agent terrain</small>
                  </div>
                </div>
                <div>
                  <span className="quickIcon violet">↗</span>
                  <div>
                    <strong>{stats.inProgress} mission(s)</strong>
                    <small>Actuellement en traitement</small>
                  </div>
                </div>
                <div>
                  <span className="quickIcon green">✓</span>
                  <div>
                    <strong>{stats.resolved} résolution(s)</strong>
                    <small>Terminée(s) et publiée(s)</small>
                  </div>
                </div>
              </div>
            </article>
          </section>
        </section>
      </main>
    </div>
  );
}
