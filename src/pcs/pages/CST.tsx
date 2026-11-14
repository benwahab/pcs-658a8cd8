import { useEffect, useMemo, useRef, useState } from "react";
import { NigerRegionMap, TrendChart, MiniDashboardPreview } from "../components/cst/CstVisuals";
import { Link, useNavigate } from "@/pcs/router";
import { supabase } from "@/pcs/lib/supabase";
import { LoginBrand, LoginFooter } from "../components/LoginBrand";

async function callCst(body: Record<string, unknown>) {
  if (!supabase) throw new Error("Supabase non configuré.");
  const { data, error } = await supabase.functions.invoke("cst-auth", { body });
  if (error) throw new Error(error.message || "Service CST indisponible.");
  if (data?.error) throw new Error(data.error);
  return data as any;
}
class SessionExpiredError extends Error {
  constructor() {
    super("Votre session CST a expiré. Reconnectez-vous.");
  }
}
async function health() {
  if (!supabase) throw new Error("Supabase non configuré.");
  const invoke = (accessToken: string) =>
    supabase!.functions.invoke("cst-health", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  const refreshAccessToken = async () => {
    const { data, error } = await supabase!.auth.refreshSession();
    if (error || !data.session?.access_token)
      throw new Error("Votre session CST a expiré. Reconnectez-vous.");
    return data.session.access_token;
  };
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error("Impossible de vérifier la session CST. Reconnectez-vous.");
  let accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Votre session CST a expiré. Reconnectez-vous.");
  // Refresh shortly before expiry to avoid sending a token that expires in transit.
  if (
    sessionData.session?.expires_at &&
    sessionData.session.expires_at * 1000 <= Date.now() + 90000
  ) {
    accessToken = await refreshAccessToken();
  }
  let result = await invoke(accessToken);
  const status = (result.error as any)?.context?.status;
  if (status === 401) {
    // A parallel tab/request may have rotated the refresh token; re-read the
    // current session before attempting a single controlled refresh.
    const { data: current } = await supabase.auth.getSession();
    if (current.session?.access_token && current.session.access_token !== accessToken) {
      accessToken = current.session.access_token;
    } else {
      accessToken = await refreshAccessToken();
    }
    result = await invoke(accessToken);
    if ((result.error as any)?.context?.status === 401) {
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      throw new SessionExpiredError();
    }
  }
  if (result.error || result.data?.error)
    throw new Error(
      result.data?.error ?? (result.error as any)?.message ?? "Supervision indisponible.",
    );
  return result.data as any;
}
async function mediaModeration(body: Record<string, unknown> = { action: "list" }) {
  if (!supabase) throw new Error("Supabase non configuré.");
  const getAccessToken = async (forceRefresh = false) => {
    const { data, error } = forceRefresh
      ? await supabase!.auth.refreshSession()
      : await supabase!.auth.getSession();
    if (error || !data.session?.access_token) throw new SessionExpiredError();
    if (
      !forceRefresh &&
      data.session.expires_at &&
      data.session.expires_at * 1000 <= Date.now() + 60000
    ) {
      const refreshed = await supabase!.auth.refreshSession();
      if (refreshed.error || !refreshed.data.session?.access_token) throw new SessionExpiredError();
      return refreshed.data.session.access_token;
    }
    return data.session.access_token;
  };
  let accessToken = await getAccessToken();
  let result = await supabase.functions.invoke("cst-media-moderation", {
    body,
    headers: { Authorization: "Bearer " + accessToken },
  });
  if ((result.error as any)?.context?.status === 401) {
    accessToken = await getAccessToken(true);
    result = await supabase.functions.invoke("cst-media-moderation", {
      body,
      headers: { Authorization: "Bearer " + accessToken },
    });
    if ((result.error as any)?.context?.status === 401) {
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      throw new SessionExpiredError();
    }
  }
  if (result.error || result.data?.error) {
    const status = (result.error as any)?.context?.status;
    if (status === 503)
      throw new Error(
        "Service de modération temporairement indisponible. Le tableau réessaiera automatiquement.",
      );
    throw new Error(
      result.data?.error ?? (result.error as any)?.message ?? "Service de modération indisponible.",
    );
  }
  return result.data as any;
}
async function listVideoArchives() {
  if (!supabase) throw new Error("Supabase non configuré.");
  const { data, error } = await supabase.functions.invoke("cst-video-archives", {
    body: { action: "list" },
  });
  if (error || data?.error)
    throw new Error(data?.error ?? "Impossible de charger les archives vidéo.");
  return data as any;
}
async function reportManagement(body: Record<string, unknown>) {
  if (!supabase) throw new Error("Supabase non configuré.");
  const { data, error } = await supabase.functions.invoke("cst-report-management", { body });
  if (error || data?.error)
    throw new Error(data?.error ?? "Gestion des signalements indisponible.");
  return data as any;
}
async function professionalAccounts(body: Record<string, unknown>) {
  if (!supabase) throw new Error("Supabase non configuré.");
  const { data, error } = await supabase.functions.invoke("cst-auth", { body });
  if (error || data?.error)
    throw new Error(data?.error ?? "Gestion des comptes professionnels indisponible.");
  return data as any;
}
async function operationalOverview() {
  if (!supabase) throw new Error("Supabase non configuré.");
  const { data, error } = await supabase.functions.invoke("cst-operations", { method: "GET" });
  if (error || data?.error)
    throw new Error(data?.error ?? "Impossible de charger la supervision opérationnelle.");
  return data as any;
}
async function setArchiveHold(archiveId: string, action: "hold" | "release", reason?: string) {
  if (!supabase) throw new Error("Supabase non configuré.");
  const { data, error } = await supabase.functions.invoke("cst-video-archives", {
    body: { action, archive_id: archiveId, reason },
  });
  if (error || data?.error)
    throw new Error(data?.error ?? "Impossible de modifier la conservation.");
  return data;
}
async function cleanupExpiredArchives(dryRun: boolean) {
  if (!supabase) throw new Error("Supabase non configuré.");
  const { data, error } = await supabase.functions.invoke("cst-video-archives", {
    body: { action: "cleanup", dry_run: dryRun, limit: 100 },
  });
  if (error || data?.error) throw new Error(data?.error ?? "Nettoyage impossible.");
  return data as any;
}
const Dot = ({ s }: { s: string }) => <span className={"cstStatusDot " + s} aria-hidden="true" />;
const EyeIcon = ({ off = false }: { off?: boolean }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="cstEyeIcon">
    <path d="M2.2 12s3.3-5.2 9.8-5.2S21.8 12 21.8 12 18.5 17.2 12 17.2 2.2 12 2.2 12Z" />
    <circle cx="12" cy="12" r="2.8" />
    {off && <path d="m4 4 16 16" />}
  </svg>
);
const unavailable = "Source non connectée";

export function CSTAccess() {
  const nav = useNavigate();
  const [setup, setSetup] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [recoveryChange, setRecoveryChange] = useState(false);
  useEffect(() => {
    let active = true;
    const {
      data: { subscription },
    } = supabase!.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && active) {
        setRecoveryChange(true);
        setRecovery(false);
        setBusy(false);
      }
    });
    (async () => {
      try {
        const { data: sd } = await supabase!.auth.getSession();
        if (sd.session && !recoveryChange) {
          const { data: a } = await (supabase as any)
            .from("cst_accounts")
            .select("id")
            .eq("user_id", sd.session.user.id)
            .maybeSingle();
          if (a) {
            nav("/cst/dashboard");
            return;
          }
        }
        const s = await callCst({ action: "status" });
        setSetup(!s.configured);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Accès CST indisponible.");
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [nav, recoveryChange]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      if (recovery) {
        if (!email.trim()) throw new Error("Saisissez votre identifiant professionnel.");
        const { error } = await supabase!.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin + "/cst",
        });
        if (error) throw error;
        setInfo(
          "Si cette adresse correspond au compte CST, un email de récupération a été envoyé.",
        );
        setRecovery(false);
        return;
      }
      if (recoveryChange) {
        if (pw.length < 12)
          throw new Error("Le nouveau mot de passe doit contenir au moins 12 caractères.");
        if (pw !== confirm) throw new Error("Les deux mots de passe ne correspondent pas.");
        const { error } = await supabase!.auth.updateUser({ password: pw });
        if (error) throw error;
        await supabase!.auth.signOut();
        setRecoveryChange(false);
        setPw("");
        setConfirm("");
        setInfo("Mot de passe mis à jour. Vous pouvez maintenant vous reconnecter.");
        return;
      }
      if (setup && pw !== confirm) {
        setError("Les deux mots de passe ne correspondent pas.");
        return;
      }
      if (setup && pw.length < 12) {
        setError("Le mot de passe doit contenir au moins 12 caractères.");
        return;
      }
      if (setup) await callCst({ action: "bootstrap", email, password: pw });
      const r = await callCst({ action: "login", email, password: pw });
      const { error } = await supabase!.auth.setSession(r.session);
      if (error) throw error;
      nav("/cst/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connexion CST impossible.");
    } finally {
      setBusy(false);
    }
  }
  if (setup === null && !recoveryChange)
    return (
      <section className="cstAuthPage pcsLoginPage">
        <div className="cstAuthCard pcsLogin">
          <LoginBrand />
          {error ? (
            <>
              <div className="cstSecurityNote">
                <Dot s="critical" />
                Impossible d’initialiser le CST.
              </div>
              <p className="error">{error}</p>
              <button
                className="button primary"
                type="button"
                onClick={() => window.location.reload()}
              >
                Réessayer
              </button>
            </>
          ) : (
            <div className="cstSecurityNote">
              <Dot s="healthy" />
              Initialisation du CST…
            </div>
          )}
        </div>
      </section>
    );
  return (
    <section className="cstAuthPage pcsLoginPage">
      <div className="cstAuthCard pcsLogin">
        <LoginBrand />
        <p className="cstLead">Espace sécurisé réservé à l’administration technique de PCS.</p>
        {!recoveryChange && (
          <div className="cstSecurityNote">
            <Dot s="healthy" />
            {setup
              ? "Première configuration — un seul compte sera créé."
              : "Compte CST configuré — inscription fermée."}
          </div>
        )}
        {recoveryChange && (
          <div className="cstSecurityNote">
            <Dot s="healthy" />
            Réinitialisation sécurisée du mot de passe CST.
          </div>
        )}
        <form className="form" onSubmit={submit}>
          {!recoveryChange && (
            <label>
              Identifiant professionnel
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>
          )}
          {recoveryChange && (
            <label>
              Nouveau mot de passe
              <div className="cstPasswordField">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  minLength={12}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="cstPasswordToggle"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  <EyeIcon off={!showPw} />
                </button>
              </div>
            </label>
          )}
          {recoveryChange && (
            <label>
              Confirmer le nouveau mot de passe
              <div className="cstPasswordField">
                <input
                  type={showConfirm ? "text" : "password"}
                  required
                  minLength={12}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="cstPasswordToggle"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? "Masquer la confirmation" : "Afficher la confirmation"}
                >
                  <EyeIcon off={!showConfirm} />
                </button>
              </div>
            </label>
          )}
          {!recovery && !recoveryChange && (
            <label>
              Mot de passe
              <div className="cstPasswordField">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  minLength={12}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  autoComplete={setup ? "new-password" : "current-password"}
                />
                <button
                  type="button"
                  className="cstPasswordToggle"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  <EyeIcon off={!showPw} />
                </button>
              </div>
            </label>
          )}
          {setup && !recovery && !recoveryChange && (
            <label>
              Confirmer le mot de passe
              <div className="cstPasswordField">
                <input
                  type={showConfirm ? "text" : "password"}
                  required
                  minLength={12}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="cstPasswordToggle"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? "Masquer la confirmation" : "Afficher la confirmation"}
                >
                  <EyeIcon off={!showConfirm} />
                </button>
              </div>
            </label>
          )}
          {error && <p className="error">{error}</p>}
          {info && <p className="cstInfo">{info}</p>}
          <button className="button primary" disabled={busy}>
            {busy
              ? "Veuillez patienter…"
              : recoveryChange
                ? "Mettre à jour le mot de passe"
                : recovery
                  ? "Envoyer le lien de récupération"
                  : setup
                    ? "Créer le compte CST"
                    : "Se connecter"}
          </button>
        </form>
        {!setup && !recovery && !recoveryChange && (
          <button
            className="button cstRecoveryButton"
            onClick={() => {
              setRecovery(true);
              setError("");
              setInfo("");
              setPw("");
              setConfirm("");
            }}
          >
            Récupérer l’accès
          </button>
        )}
        {(recovery || recoveryChange) && (
          <button
            className="button cstRecoveryButton"
            onClick={() => {
              setRecovery(false);
              setRecoveryChange(false);
              setError("");
              setInfo("");
              setPw("");
              setConfirm("");
            }}
          >
            Retour à la connexion
          </button>
        )}
        <Link className="button" to="/">
          Accueil
        </Link>
        <LoginFooter />
      </div>
    </section>
  );
}

function Status({ value }: { value: string }) {
  return (
    <span className="cstStatus">
      <Dot s={value} />
      {value === "healthy"
        ? "Healthy"
        : value === "degraded"
          ? "Degraded"
          : value === "critical"
            ? "Critical"
            : "Offline"}
    </span>
  );
}

export function CSTDashboard() {
  const nav = useNavigate();
  const [data, setData] = useState<any>(null);
  const [operations, setOperations] = useState<any>(null);
  const [error, setError] = useState("");
  const [last, setLast] = useState("");
  const [traceFilter, setTraceFilter] = useState("");
  const [mediaQueue, setMediaQueue] = useState<any[]>([]);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [archives, setArchives] = useState<any[]>([]);
  const [archivesBusy, setArchivesBusy] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [reportsBusy, setReportsBusy] = useState(false);
  const [reportSearch, setReportSearch] = useState("");
  const [reportRegionFilter, setReportRegionFilter] = useState("");
  const [reportActionBusy, setReportActionBusy] = useState(false);
  const [archiveSearch, setArchiveSearch] = useState("");
  const [rejectingId, setRejectingId] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [orgRequests, setOrgRequests] = useState<any[]>([]);
  const [orgReviewBusy, setOrgReviewBusy] = useState(false);
  const [orgRejectingId, setOrgRejectingId] = useState("");
  const [orgRejectNote, setOrgRejectNote] = useState("");
  const [mairieRequests, setMairieRequests] = useState<any[]>([]);
  const [mairieReviewBusy, setMairieReviewBusy] = useState(false);
  const [professionalAccountsList, setProfessionalAccountsList] = useState<any[]>([]);
  const [professionalAccountsBusy, setProfessionalAccountsBusy] = useState(false);
  const [professionalAccountActionBusy, setProfessionalAccountActionBusy] = useState(false);
  const [professionalAccountSearch, setProfessionalAccountSearch] = useState("");
  const queueLoadedAt = useRef(0);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(t);
  }, []);
  const dashboardActive = useRef(true);
  const timersRef = useRef<number[]>([]);
  const stopDashboardWork = () => {
    dashboardActive.current = false;
    timersRef.current.forEach((id) => window.clearInterval(id));
    timersRef.current = [];
  };
  const refreshOrganizationRequests = async () => {
    if (!supabase) throw new Error("Supabase non configuré.");
    const { data, error } = await supabase.rpc("list_organization_signup_requests");
    if (error) throw error;
    setOrgRequests((data ?? []).filter((r: any) => r.status === "pending"));
  };
  const refreshProfessionalAccounts = async () => {
    setProfessionalAccountsBusy(true);
    try {
      const result = await professionalAccounts({ action: "list_professional_accounts" });
      setProfessionalAccountsList(result.accounts ?? []);
    } finally {
      setProfessionalAccountsBusy(false);
    }
  };
  const refreshMairieRequests = async () => {
    if (!supabase) throw new Error("Supabase non configuré.");
    const { data, error } = await supabase.rpc("list_pending_mairie_requests");
    if (error) throw error;
    setMairieRequests(data ?? []);
  };
  async function reviewMairieRequest(id: string, approve: boolean) {
    setMairieReviewBusy(true);
    setError("");
    try {
      if (!supabase) throw new Error("Supabase non configuré.");
      const { error } = await supabase.rpc(
        approve ? "approve_mairie_request" : "reject_mairie_request",
        { p_mairie_id: id },
      );
      if (error) throw error;
      await refreshMairieRequests();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Traitement de la demande mairie impossible.");
    } finally {
      setMairieReviewBusy(false);
    }
  }
  async function reviewOrganizationRequest(id: string, approve: boolean) {
    setOrgReviewBusy(true);
    setError("");
    try {
      if (!supabase) throw new Error("Supabase non configuré.");
      if (approve) {
        const { error } = await supabase.rpc("approve_organization_signup_request", {
          p_request_id: id,
        });
        if (error) throw error;
      } else {
        const note = orgRejectNote.trim();
        if (note.length < 5)
          throw new Error("Le motif du refus doit contenir au moins 5 caractères.");
        const { error } = await supabase.rpc("reject_organization_signup_request", {
          p_request_id: id,
          p_note: note,
        });
        if (error) throw error;
      }
      setOrgRejectingId("");
      setOrgRejectNote("");
      await refreshOrganizationRequests();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Traitement de la demande NIGELEC/NDE impossible.");
    } finally {
      setOrgReviewBusy(false);
    }
  }
  const refreshQueue = async (forceUrlRefresh = false) => {
    const result = await mediaModeration({ action: "list" });
    const now = Date.now();
    setMediaQueue((previous) => {
      const oldById = new Map(previous.map((item: any) => [item.id, item]));
      const refreshUrls = forceUrlRefresh || now - queueLoadedAt.current >= 12 * 60 * 1000;
      return (result?.items ?? []).map((item: any) => {
        const old: any = oldById.get(item.id);
        return old && !refreshUrls && old.preview_url
          ? { ...item, preview_url: old.preview_url }
          : item;
      });
    });
    queueLoadedAt.current = now;
    setError((previous) =>
      /modération|file vidéo|description does not exist/i.test(previous) ? "" : previous,
    );
  };
  useEffect(() => {
    let active = true;
    dashboardActive.current = true;
    const verify = async () => {
      try {
        const { data: s } = await supabase!.auth.getSession();
        if (!s.session) {
          nav("/cst");
          return;
        }
        const { data: a } = await (supabase as any)
          .from("cst_accounts")
          .select("id")
          .eq("user_id", s.session.user.id)
          .maybeSingle();
        if (!a) {
          nav("/cst");
          return;
        }
        if (active) {
          try {
            const { data: regionRows, error: regionError } = await supabase!
              .from("regions")
              .select("id,name")
              .order("name", { ascending: true });
            if (regionError) throw regionError;
            if (active) setRegions(regionRows ?? []);
          } catch (e) {
            if (active)
              setError(
                e instanceof Error
                  ? "Liste des régions indisponible : " + e.message
                  : "Impossible de charger les régions.",
              );
          }
        }
        if (active) {
          await refreshQueue();
        }
        if (active) {
          setReportsBusy(true);
          try {
            const result = await reportManagement({ action: "list" });
            if (active) setReports(result.items ?? []);
          } finally {
            if (active) setReportsBusy(false);
          }
        }
        if (active) {
          setArchivesBusy(true);
          try {
            const archiveResult = await listVideoArchives();
            if (active) setArchives(archiveResult.items ?? []);
          } finally {
            if (active) setArchivesBusy(false);
          }
        }
        if (active) {
          try {
            await refreshOrganizationRequests();
          } catch (e) {
            if (active)
              setError(
                e instanceof Error
                  ? "Demandes NIGELEC/NDE indisponibles : " + e.message
                  : "Impossible de charger les demandes NIGELEC/NDE.",
              );
          }
        }
        if (active) {
          try {
            await refreshProfessionalAccounts();
          } catch (e) {
            if (active)
              setError(
                e instanceof Error
                  ? "Comptes professionnels indisponibles : " + e.message
                  : "Impossible de charger les comptes professionnels.",
              );
          }
        }
        if (active) {
          try {
            await refreshMairieRequests();
          } catch (e) {
            if (active)
              setError(
                e instanceof Error
                  ? "Demandes mairie indisponibles : " + e.message
                  : "Impossible de charger les demandes mairie.",
              );
          }
        }
        if (active) {
          try {
            const result = await operationalOverview();
            if (active) setOperations(result);
          } catch (e) {
            if (active)
              setError(
                e instanceof Error
                  ? "Supervision opérationnelle indisponible : " + e.message
                  : "Impossible de charger la supervision opérationnelle.",
              );
          }
        }
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "Impossible de charger la file de modération.");
      }
    };
    void verify();
    let healthRequestInFlight = false;
    const healthCheck = async () => {
      if (healthRequestInFlight) return;
      healthRequestInFlight = true;
      try {
        const h = await health();
        if (active) {
          setData(h);
          setLast(new Date().toLocaleTimeString("fr-FR"));
          setError((previous) =>
            previous === "Votre session CST a expiré. Reconnectez-vous." ||
            previous === "Impossible de vérifier la session CST. Reconnectez-vous."
              ? ""
              : previous,
          );
        }
      } catch (e) {
        if (e instanceof SessionExpiredError) {
          active = false;
          timersRef.current.forEach((t) => window.clearInterval(t));
          nav("/cst");
          return;
        }
        if (active) setError(e instanceof Error ? e.message : "Supervision indisponible.");
      } finally {
        healthRequestInFlight = false;
      }
    };
    void healthCheck();
    const healthTimer = window.setInterval(() => {
      if (active && dashboardActive.current && document.visibilityState === "visible")
        void healthCheck();
    }, 30000);
    const queueTimer = window.setInterval(() => {
      if (active && dashboardActive.current && document.visibilityState === "visible")
        void refreshQueue().catch((e) => {
          if (active && dashboardActive.current)
            setError(
              e instanceof Error ? e.message : "Impossible d’actualiser la file de modération.",
            );
        });
    }, 60000);
    const archiveTimer = window.setInterval(() => {
      if (active && dashboardActive.current && document.visibilityState === "visible") {
        setArchivesBusy(true);
        void listVideoArchives()
          .then((v) => {
            if (active && dashboardActive.current) setArchives(v.items ?? []);
          })
          .catch((e) => {
            if (active && dashboardActive.current)
              setError(e instanceof Error ? e.message : "Impossible de charger les archives.");
          })
          .finally(() => {
            if (active && dashboardActive.current) setArchivesBusy(false);
          });
      }
    }, 60000);
    const operationsTimer = window.setInterval(() => {
      if (active && dashboardActive.current && document.visibilityState === "visible") {
        void operationalOverview()
          .then((v) => {
            if (active && dashboardActive.current) setOperations(v);
          })
          .catch((e) => {
            if (active && dashboardActive.current)
              setError(
                e instanceof Error
                  ? e.message
                  : "Impossible d’actualiser la supervision opérationnelle.",
              );
          });
      }
    }, 60000);
    timersRef.current = [healthTimer, queueTimer, archiveTimer, operationsTimer];
    const onFocus = () => {
      if (active && dashboardActive.current && document.visibilityState === "visible")
        void refreshQueue().catch((e) => {
          if (active && dashboardActive.current)
            setError(e instanceof Error ? e.message : "Impossible d’actualiser la file vidéo.");
        });
    };
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      stopDashboardWork();
      window.removeEventListener("focus", onFocus);
    };
  }, [nav]);
  async function logout() {
    stopDashboardWork();
    setMediaQueue([]);
    setArchives([]);
    setReports([]);
    setOrgRequests([]);
    setMairieRequests([]);
    setOperations(null);
    try {
      await supabase?.auth.signOut();
    } finally {
      nav("/cst");
    }
  }
  async function approveMedia(id: string) {
    setMediaBusy(true);
    try {
      await mediaModeration({ action: "approve", media_id: id });
      setMediaQueue((q) => q.filter((v) => v.id !== id));
      await refreshQueue(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approbation impossible.");
    } finally {
      setMediaBusy(false);
    }
  }
  async function rejectMedia(id: string) {
    const reason = rejectReason.trim();
    if (reason.length < 5) {
      setError("Le motif de rejet doit contenir au moins 5 caractères.");
      return;
    }
    setMediaBusy(true);
    try {
      await mediaModeration({ action: "reject", media_id: id, reason });
      setMediaQueue((q) => q.filter((v) => v.id !== id));
      setRejectingId("");
      setRejectReason("");
      await refreshQueue(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rejet impossible.");
    } finally {
      setMediaBusy(false);
    }
  }
  const db = data?.database;
  const m = data?.metrics ?? {};
  const global = error ? "degraded" : (db?.status ?? "offline");
  const requests = data?.live_requests ?? [];
  const frontend = data?.frontend_events ?? [];
  const traces = useMemo(
    () =>
      requests.filter(
        (r: any) => !traceFilter || r.trace_id?.toLowerCase().includes(traceFilter.toLowerCase()),
      ),
    [requests, traceFilter],
  );
  const alerts = [
    m.error_rate_percent > 5
      ? {
          severity: "critical",
          title: "ERROR RATE > 5%",
          detail: `Taux actuel : ${m.error_rate_percent}%`,
        }
      : null,
    m.average_latency_ms > 1000
      ? {
          severity: "warning",
          title: "LATENCY > 1000 ms",
          detail: `Moyenne actuelle : ${m.average_latency_ms} ms`,
        }
      : null,
    db?.connection_utilization_percent > 80
      ? {
          severity: "warning",
          title: "DATABASE CONNECTIONS > 80%",
          detail: `Utilisation : ${db.connection_utilization_percent}%`,
        }
      : null,
  ].filter(Boolean) as any[];
  const api = data?.api_monitoring ?? [];
  const reportCounts = operations?.reports ?? {};
  const missionCounts = operations?.missions ?? {};
  const reportTotal = Object.values(reportCounts as Record<string, unknown>).reduce<number>(
    (sum, value) => sum + Number(value ?? 0),
    0,
  );
  const statusLabel = (s: string) =>
    (
      ({
        submitted: "Soumis",
        received: "Reçu",
        verification: "En vérification",
        in_progress: "En cours",
        resolved: "Résolu",
        rejected: "Rejeté",
      }) as Record<string, string>
    )[s] ?? String(s ?? "—").replace(/_/g, " ");
  const tones = ["#5b2a91", "#8b5cf6", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444"];
  const statusEntries = Object.entries(reportCounts as Record<string, unknown>)
    .map(([k, v]) => [k, Number(v ?? 0)] as [string, number])
    .filter(([, n]) => n > 0);
  let acc = 0;
  const donutStops =
    statusEntries
      .map(([, n], i) => {
        const a = (acc / (reportTotal || 1)) * 360;
        acc += n;
        const b = (acc / (reportTotal || 1)) * 360;
        return `${tones[i % tones.length]} ${a}deg ${b}deg`;
      })
      .join(",") || "#ece7fb 0deg 360deg";
  const resolved = Number(reportCounts.resolved ?? 0);
  const pendingReports =
    Number(reportCounts.submitted ?? 0) +
    Number(reportCounts.received ?? 0) +
    Number(reportCounts.verification ?? 0);
  const resolutionRate = reportTotal ? Math.round((resolved / reportTotal) * 100) : 0;
  const missionRows: [string, unknown][] = [
    ["Assignées", missionCounts.assigned],
    ["Acceptées", missionCounts.accepted],
    ["En cours", missionCounts.in_progress],
    ["Terminées", missionCounts.completed],
    ["Refusées", missionCounts.declined],
  ];
  const missionMax = Math.max(1, ...missionRows.map(([, v]) => Number(v ?? 0)));
  const latestReports = [...reports]
    .sort((a: any, b: any) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
    .slice(0, 5);
  const alertCount = alerts.length + (mairieRequests.length + orgRequests.length > 0 ? 1 : 0);
  const [techOpen, setTechOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  useEffect(() => {
    const top = new Set([
      "",
      "cst-home",
      "cst-stats",
      "cst-map",
      "cst-activity",
      "cst-alerts",
      "cst-tech",
    ]);
    const sync = () => {
      const h = window.location.hash.slice(1);
      if (!top.has(h)) {
        setManageOpen(true);
        setTimeout(() => document.getElementById(h)?.scrollIntoView({ behavior: "smooth" }), 80);
      }
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const [openMenu, setOpenMenu] = useState<string>("");
  const [userMenu, setUserMenu] = useState(false);
  const [stats, setStats] = useState<any[]>([]);
  useEffect(() => {
    let on = true;
    (async () => {
      try {
        if (!supabase) return;
        const { data } = await (supabase as any)
          .from("reports")
          .select("id,created_at,status,categories(name),regions(name)")
          .order("created_at", { ascending: false })
          .limit(2000);
        if (on) setStats(data ?? []);
      } catch {
        // Statistics are optional: keep the current values if the request fails.
      }
    })();
    return () => {
      on = false;
    };
  }, [reports.length]);
  const statById = new Map(stats.map((s: any) => [s.id, s]));
  const dayMs = 86400000;
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const inWin = (r: any, from: number, to: number) => {
    const t = new Date(r.created_at).getTime();
    return t >= from && t < to;
  };
  const wk = (f: (r: any) => boolean, w: number) =>
    stats.filter(
      (r) => inWin(r, today0 + dayMs - (w + 1) * 7 * dayMs, today0 + dayMs - w * 7 * dayMs) && f(r),
    ).length;
  const trend = (f: (r: any) => boolean) => {
    const a = wk(f, 0),
      b = wk(f, 1);
    if (!b) return a ? "+100%" : "0%";
    const p = Math.round(((a - b) / b) * 100);
    return (p >= 0 ? "+" : "") + p + "%";
  };
  const isTreated = (r: any) => ["in_progress", "resolved"].includes(r.status);
  const trendPoints = Array.from({ length: 8 }, (_, i) => {
    const from = today0 - (7 - i) * dayMs;
    const rows = stats.filter((r) => inWin(r, from, from + dayMs));
    return {
      label: new Date(from).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
      received: rows.length,
      treated: rows.filter(isTreated).length,
      resolved: rows.filter((r: any) => r.status === "resolved").length,
    };
  });
  const catCounts: Record<string, number> = {};
  stats.forEach((r: any) => {
    const k = r.categories?.name ?? "Autres";
    catCounts[k] = (catCounts[k] ?? 0) + 1;
  });
  const catSorted = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
  const catTop = catSorted.slice(0, 5);
  const catOther = catSorted.slice(5).reduce((s, [, n]) => s + n, 0);
  const catEntries: [string, number][] = catOther ? [...catTop, ["Autres", catOther]] : catTop;
  const catTones = ["#5b21b6", "#8b5cf6", "#38bdf8", "#22c58b", "#f59e0b", "#64748b"];
  const catTotal = stats.length;
  let cacc = 0;
  const catStops =
    catEntries
      .map(([, n], i) => {
        const a = (cacc / (catTotal || 1)) * 360;
        cacc += n;
        return `${catTones[i]} ${a}deg ${(cacc / (catTotal || 1)) * 360}deg`;
      })
      .join(",") || "#ece7fb 0deg 360deg";
  const regionCounts: Record<string, number> = {};
  stats.forEach((r: any) => {
    const k = r.regions?.name;
    if (k) regionCounts[k] = (regionCounts[k] ?? 0) + 1;
  });
  const statusTone = (s: string) =>
    s === "resolved" ? "ok" : s === "in_progress" ? "run" : s === "rejected" ? "bad" : "wait";
  const navItems: {
    id: string;
    label: string;
    icon: string;
    href?: string;
    to?: string;
    sub?: [string, string][];
  }[] = [
    { id: "home", label: "Tableau de bord", icon: "⌂", href: "#cst-home" },
    { id: "reports", label: "Signalements", icon: "🔔", href: "#report-management" },
    {
      id: "media",
      label: "Modération des médias",
      icon: "▣",
      sub: [
        ["#moderation", "Photos et vidéos en attente"],
        ["#archives", "Archives vidéo"],
      ],
    },
    {
      id: "regions",
      label: "Régions et communes",
      icon: "▦",
      sub: [
        ["#cst-map", "Carte par région"],
        ["#governance", "Gouvernance territoriale"],
      ],
    },
    { id: "mods", label: "Gestion des modérateurs", icon: "👥", to: "/cst/moderateurs" },
    {
      id: "inst",
      label: "Mairies et institutions",
      icon: "🏛",
      sub: [
        ["#mairie-signups", "Demandes mairies"],
        ["#org-signups", "Demandes NIGELEC / NDE"],
        ["#professional-accounts", "Comptes approuvés"],
      ],
    },
    { id: "ops", label: "Suivi des interventions", icon: "⚙", href: "#governance" },
    { id: "stats", label: "Statistiques et rapports", icon: "▥", href: "#cst-stats" },
    { id: "journal", label: "Journal des activités", icon: "◷", href: "#cst-activity" },
    { id: "settings", label: "Paramètres CST", icon: "⚙", href: "#professional-accounts" },
  ];
  const spaces: [string, string, string, string, string][] = [
    [
      "#mairie-signups",
      "Mairies et institutions",
      "Gestion des collectivités et institutions partenaires.",
      "violet",
      "#7c3aed",
    ],
    [
      "#org-signups",
      "Nigelec",
      "Suivi des coupures et de la fourniture d’électricité.",
      "green",
      "#22c58b",
    ],
    [
      "#org-signups",
      "NDE",
      "Gestion de l’eau potable et des infrastructures hydrauliques.",
      "blue",
      "#3b82f6",
    ],
    [
      "#governance",
      "Agents",
      "Suivi des agents et de leurs interventions sur le terrain.",
      "orange",
      "#f59e0b",
    ],
  ];
  return (
    <section className="cstDashboard cstDashboardRebuilt cstRefV2">
      <aside className="cstSidebar">
        <div className="cstBrandLockup">
          <span className="cstBrandSymbol">P</span>
          <div>
            <strong>PCS</strong>
            <small>Plateforme Citoyenne de Signalement</small>
          </div>
        </div>
        <div className="cstSidebarLabel">CST - Centre de Supervision Technique</div>
        <nav className="cstNav">
          {navItems.map((it, i) => {
            const inner = (
              <>
                <span className="cstNavGlyph">{it.icon}</span>
                <span className="cstNavText">{it.label}</span>
                {it.sub && (
                  <b className={"cstNavChevron" + (openMenu === it.id ? " isOpen" : "")}>›</b>
                )}
              </>
            );
            if (it.to)
              return (
                <Link key={it.id} to={it.to as any}>
                  {inner}
                  <b className="cstNavChevron">›</b>
                </Link>
              );
            if (it.sub)
              return (
                <div key={it.id} className="cstNavGroup">
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setOpenMenu((o) => (o === it.id ? "" : it.id));
                    }}
                    aria-expanded={openMenu === it.id}
                  >
                    {inner}
                  </a>
                  {openMenu === it.id && (
                    <div className="cstNavSub">
                      {it.sub.map(([h, l]) => (
                        <a key={h} href={h}>
                          {l}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            return (
              <a key={it.id} className={i === 0 ? "isActive" : ""} href={it.href}>
                {inner}
              </a>
            );
          })}
        </nav>
        <button
          type="button"
          className={"cstTechToggle" + (manageOpen ? " isOpen" : "")}
          onClick={() => {
            setManageOpen((v) => !v);
            if (!manageOpen)
              setTimeout(
                () => document.getElementById("cst-manage")?.scrollIntoView({ behavior: "smooth" }),
                60,
              );
          }}
        >
          <span className="cstNavGlyph">▦</span>
          <span>Gestion détaillée</span>
          <b>{manageOpen ? "Masquer" : "Afficher"}</b>
        </button>
        <button
          type="button"
          className={"cstTechToggle" + (techOpen ? " isOpen" : "")}
          onClick={() => {
            setTechOpen((v) => !v);
            if (!techOpen)
              setTimeout(
                () => document.getElementById("cst-tech")?.scrollIntoView({ behavior: "smooth" }),
                60,
              );
          }}
        >
          <span className="cstNavGlyph">⌘</span>
          <span>Supervision technique</span>
          <b>{techOpen ? "Masquer" : "Afficher"}</b>
        </button>
        <div className="cstSidebarNote">
          <span>Une plateforme au service du citoyen et pour un Niger plus sûr</span>
          <svg viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 60 L0 40 Q30 20 60 34 T120 22 T200 8 L200 60 Z" />
          </svg>
        </div>
        <div className="cstSidebarStatus">
          <i />
          <div>
            <strong>En ligne</strong>
            <small>CST - Centre de Supervision Technique</small>
          </div>
        </div>
      </aside>
      <main className="cstWorkspace" id="cst-home">
        <div className="cstUtilityBar">
          <div className="cstSearchVisual">
            <span className="cstSearchIcon">⌕</span>
            <span>Rechercher un signalement, une région, un utilisateur…</span>
          </div>
          <div className="cstUtilityRight">
            <a href="#cst-alerts" className="cstBell" aria-label="Alertes">
              🔔{alertCount > 0 && <b>{alertCount}</b>}
            </a>
            <div className="cstClock">
              <small>
                {now.toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </small>
              <strong>
                {now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </strong>
            </div>
            <div className="cstUserWrap">
              <button
                type="button"
                className="cstUserChip"
                onClick={() => setUserMenu((v) => !v)}
                aria-expanded={userMenu}
              >
                <span className="cstAvatar">CST</span>
                <div>
                  <strong>Compte CST</strong>
                  <small>CST - Administrateur</small>
                </div>
                <b>⌄</b>
              </button>
              {userMenu && (
                <div className="cstUserMenu">
                  <button type="button" onClick={logout}>
                    Déconnexion
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <header className="cstPageHeading">
          <div>
            <h1>Tableau de bord CST</h1>
            <p className="cstSubtitle">Supervision nationale - PCS</p>
          </div>
          <span className={"cstLivePill " + global}>
            <i>✓</i>
            {global === "healthy"
              ? "Système opérationnel"
              : global === "degraded"
                ? "Attention requise"
                : "État indisponible"}
          </span>
        </header>
        {error && (
          <div className="cstBanner critical">
            <Dot s="critical" />
            {error}
          </div>
        )}
        <div className="cstRefLayout">
          <div className="cstRefMain">
            <section className="cstKpiGrid" aria-label="Indicateurs principaux">
              {(
                [
                  ["violet", "▤", "Signalements reçus", reportTotal, trend(() => true)],
                  [
                    "orange",
                    "◷",
                    "En attente de validation",
                    pendingReports,
                    trend((r: any) => ["submitted", "received", "verification"].includes(r.status)),
                  ],
                  [
                    "blue",
                    "👥",
                    "En cours de traitement",
                    Number(reportCounts.in_progress ?? 0),
                    trend((r: any) => r.status === "in_progress"),
                  ],
                  ["green", "✓", "Résolus", resolved, trend((r: any) => r.status === "resolved")],
                ] as [string, string, string, number, string][]
              ).map(([tone, ic, label, val, tr]) => (
                <article className="cstKpiCard" key={label}>
                  <span className={"cstKpiIcon " + tone}>{ic}</span>
                  <div>
                    <small>{label}</small>
                    <div className="cstKpiValue">
                      <strong>{val.toLocaleString("fr-FR")}</strong>
                      <span className={tr.startsWith("-") ? "down" : "up"}>
                        {tr.startsWith("-") ? "↓" : "↑"} {tr}
                      </span>
                    </div>
                    <em>vs. semaine précédente</em>
                  </div>
                </article>
              ))}
            </section>
            <section className="cstRefRow3" id="cst-stats">
              <article className="cstPanel cstTrendPanel">
                <div className="cstPanelHeading">
                  <div>
                    <h2>Évolution des signalements</h2>
                  </div>
                  <span className="cstRangePill">7 derniers jours ⌄</span>
                </div>
                <ul className="cstSeriesLegend">
                  <li>
                    <i style={{ background: "#5b21b6" }} />
                    Reçus
                  </li>
                  <li>
                    <i style={{ background: "#3b82f6" }} />
                    Traités
                  </li>
                  <li>
                    <i style={{ background: "#22c58b" }} />
                    Résolus
                  </li>
                </ul>
                <TrendChart points={trendPoints} />
              </article>
              <article className="cstPanel">
                <div className="cstPanelHeading">
                  <div>
                    <h2>Répartition par catégorie</h2>
                  </div>
                  <a href="#report-management">Voir tout</a>
                </div>
                <div className="cstDonutWrap">
                  <div className="cstDonut" style={{ background: `conic-gradient(${catStops})` }}>
                    <div>
                      <strong>{catTotal.toLocaleString("fr-FR")}</strong>
                      <small>signalements</small>
                    </div>
                  </div>
                  <ul className="cstLegend">
                    {catEntries.length ? (
                      catEntries.map(([k, n], i) => (
                        <li key={k}>
                          <i style={{ background: catTones[i] }} />
                          <span>{k}</span>
                          <b>{Math.round((n / (catTotal || 1)) * 100)}%</b>
                        </li>
                      ))
                    ) : (
                      <li>
                        <span>Aucune donnée</span>
                      </li>
                    )}
                  </ul>
                </div>
              </article>
              <article className="cstPanel" id="cst-map">
                <div className="cstPanelHeading">
                  <div>
                    <h2>Signalements par région</h2>
                  </div>
                  <a href="#governance">Voir tout</a>
                </div>
                <NigerRegionMap counts={regionCounts} />
              </article>
            </section>
            <section className="cstRefRow2">
              <article className="cstPanel">
                <div className="cstPanelHeading">
                  <div>
                    <h2>Derniers signalements</h2>
                  </div>
                  <a href="#report-management">Voir tout</a>
                </div>
                {latestReports.length ? (
                  <div className="cstTableWrap">
                    <table className="cstRefTable">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Catégorie</th>
                          <th>Commune</th>
                          <th>Région</th>
                          <th>Statut</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {latestReports.map((r: any) => {
                          const s: any = statById.get(r.id);
                          return (
                            <tr key={r.id}>
                              <td>{r.reference_code ?? "—"}</td>
                              <td>
                                <span className={"cstCatDot t-" + statusTone(r.status)} />
                                {s?.categories?.name ?? "—"}
                              </td>
                              <td>{r.location_label ?? "—"}</td>
                              <td>{s?.regions?.name ?? "—"}</td>
                              <td>
                                <span className={"cstStatusChip s-" + r.status}>
                                  {statusLabel(r.status)}
                                </span>
                              </td>
                              <td>
                                {r.created_at
                                  ? new Date(r.created_at).toLocaleString("fr-FR", {
                                      day: "2-digit",
                                      month: "2-digit",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="cstEmptyState">
                    {reportsBusy ? "Chargement des signalements…" : "Aucun signalement."}
                  </p>
                )}
              </article>
              <article className="cstPanel" id="cst-activity">
                <div className="cstPanelHeading">
                  <div>
                    <h2>Activité récente</h2>
                  </div>
                  <a href="#report-management">Voir tout</a>
                </div>
                {latestReports.length ? (
                  <ul className="cstActivity">
                    {latestReports.map((r: any) => {
                      const s: any = statById.get(r.id);
                      return (
                        <li key={"a" + r.id}>
                          <span className={"cstActIcon s-" + r.status}>
                            {r.status === "resolved"
                              ? "✓"
                              : r.status === "in_progress"
                                ? "👤"
                                : "▤"}
                          </span>
                          <div>
                            <strong>
                              Signalement {r.reference_code ?? ""} · {statusLabel(r.status)}
                            </strong>
                            <small>
                              {[r.location_label, s?.categories?.name]
                                .filter(Boolean)
                                .join(" - ") || "Lieu non renseigné"}
                            </small>
                          </div>
                          <time>
                            {r.created_at
                              ? new Date(r.created_at).toLocaleTimeString("fr-FR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </time>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="cstEmptyState">Aucune activité récente.</p>
                )}
              </article>
            </section>
          </div>
          <aside className="cstRefRail">
            <article className="cstPanel cstAlertPanel" id="cst-alerts">
              <div className="cstAlertHead">
                <span>⚠</span>
                <h2>Alertes importantes</h2>
                <button
                  type="button"
                  onClick={() => {
                    setTechOpen(true);
                    setTimeout(
                      () =>
                        document.getElementById("alerts")?.scrollIntoView({ behavior: "smooth" }),
                      60,
                    );
                  }}
                >
                  Voir tout <b>{alertCount}</b>
                </button>
              </div>
              {mairieRequests.length + orgRequests.length > 0 && (
                <a href="#mairie-signups" className="cstAlertItem warning">
                  <span>!</span>
                  <div>
                    <strong>
                      {mairieRequests.length + orgRequests.length} demande(s) de compte à valider
                    </strong>
                    <small>Mairies, NIGELEC et NDE</small>
                  </div>
                </a>
              )}
              {mediaQueue.length > 0 && (
                <a href="#moderation" className="cstAlertItem warning">
                  <span>!</span>
                  <div>
                    <strong>{mediaQueue.length} média(s) à modérer</strong>
                    <small>Vérifier les médias et la validation</small>
                  </div>
                </a>
              )}
              {alerts.length > 0 && (
                <div className="cstAlertItem critical">
                  <span>♥</span>
                  <div>
                    <strong>{alerts.length} alerte(s) technique(s)</strong>
                    <small>Détails dans « Supervision technique »</small>
                  </div>
                </div>
              )}
              {alertCount === 0 && mediaQueue.length === 0 && (
                <div className="cstNoAlert">
                  <span>✓</span>
                  <div>
                    <strong>Aucune alerte active</strong>
                    <small>Les seuils surveillés sont respectés.</small>
                  </div>
                </div>
              )}
            </article>
            <article className="cstPanel">
              <div className="cstPanelHeading">
                <div>
                  <h2>Médias en attente de modération</h2>
                </div>
                <a href="#moderation">Voir tout</a>
              </div>
              <div className="cstMediaCount">
                <span className="cstKpiIcon violet small">🔒</span>
                <strong>{mediaQueue.length}</strong>
              </div>
              {mediaQueue.length > 0 && (
                <div className="cstMediaStrip">
                  {mediaQueue.slice(0, 4).map((v: any) => (
                    <a href="#moderation" key={v.id}>
                      {v.preview_url && String(v.media_type ?? "").startsWith("image/") ? (
                        <img src={v.preview_url} alt="" />
                      ) : (
                        <span>{"▶"}</span>
                      )}
                    </a>
                  ))}
                  <a href="#moderation" className="cstMediaNext">
                    ›
                  </a>
                </div>
              )}
            </article>
            <article className="cstPanel">
              <div className="cstPanelHeading">
                <div>
                  <h2>Taux de résolution</h2>
                </div>
              </div>
              <div className="cstRateWrap">
                <div
                  className="cstRing"
                  style={{
                    background: `conic-gradient(#4c1d95 ${resolutionRate * 3.6}deg,#ece7fb 0)`,
                  }}
                >
                  <div>
                    <strong>{reportTotal ? resolutionRate + "%" : "—"}</strong>
                  </div>
                </div>
                <div>
                  <span
                    className={
                      "cstRateTrend " +
                      (trend((r: any) => r.status === "resolved").startsWith("-") ? "down" : "up")
                    }
                  >
                    {trend((r: any) => r.status === "resolved")}
                  </span>
                  <p>vs. semaine précédente</p>
                </div>
              </div>
            </article>
            <article className="cstHelpCard">
              <span>⚙</span>
              <div>
                <strong>Besoin d’assistance ?</strong>
                <small>Consultez la supervision technique du CST</small>
              </div>
              <button
                type="button"
                className="button"
                onClick={() => {
                  setTechOpen(true);
                  setTimeout(
                    () =>
                      document.getElementById("cst-tech")?.scrollIntoView({ behavior: "smooth" }),
                    60,
                  );
                }}
              >
                Contacter
              </button>
            </article>
          </aside>
        </div>
        <section className="cstSpaces">
          <h2>Les autres espaces du PCS</h2>
          <p>Des tableaux de bord spécialisés pour chaque acteur de l’écosystème.</p>
          <div className="cstSpacesGrid">
            {spaces.map(([h, t, d, tone, accent]) => (
              <a href={h} key={t} className="cstSpaceCard">
                <MiniDashboardPreview accent={accent} />
                <div className="cstSpaceFoot">
                  <span className={"cstKpiIcon " + tone}>{t[0]}</span>
                  <div>
                    <strong>{t}</strong>
                    <small>{d}</small>
                  </div>
                  <b>›</b>
                </div>
              </a>
            ))}
          </div>
        </section>

        {manageOpen && (
          <section className="cstAdvancedArea" id="cst-manage">
            <div className="cstAdvancedHeading">
              <div>
                <p className="eyebrow">CENTRE DE CONTRÔLE</p>
                <h2>Gestion et supervision détaillées</h2>
                <p>Comptes, validations, modération et gouvernance du CST.</p>
              </div>
            </div>
            <div className="cstSectionGrid">
              <article className="cstCard cstWide" id="governance">
                <div className="cstModerationHead">
                  <div>
                    <p className="eyebrow">SUPERVISION GLOBALE</p>
                    <h2>Gouvernance territoriale et activité</h2>
                    <p className="cstMuted">
                      Lecture globale réservée au CST. NIGELEC et NDE restent cloisonnés pour leurs
                      opérations : le CST supervise l’état et les flux sans se substituer aux unités
                      métier.
                    </p>
                  </div>
                  <span className="cstQueueBadge">
                    {operations?.totals?.units_active ?? 0} unité(s) active(s)
                  </span>
                </div>
                {!operations ? (
                  <p className="cstMuted">Chargement de la supervision opérationnelle…</p>
                ) : (
                  <div className="cstSectionGrid">
                    <article className="cstCard">
                      <p className="eyebrow">ORGANISATIONS</p>
                      <h3>
                        {operations.totals?.organizations_active ?? 0} organisation(s) active(s)
                      </h3>
                      {(operations.organizations ?? []).map((org: any) => (
                        <div className="cstRows" key={org.code}>
                          <div>
                            <span>{org.name}</span>
                            <strong>{org.is_active ? "Active" : "Inactive"}</strong>
                          </div>
                          <div>
                            <span>Unités centrales</span>
                            <strong>{org.central_units}</strong>
                          </div>
                          <div>
                            <span>Unités locales</span>
                            <strong>{org.local_units}</strong>
                          </div>
                        </div>
                      ))}
                    </article>
                    <article className="cstCard">
                      <p className="eyebrow">SIGNALEMENTS</p>
                      <h3>{reportTotal} signalement(s)</h3>
                      <div className="cstRows">
                        {Object.entries(reportCounts as Record<string, unknown>).map(
                          ([status, count]) => (
                            <div key={status}>
                              <span>{status}</span>
                              <strong>{Number(count ?? 0)}</strong>
                            </div>
                          ),
                        )}
                      </div>
                    </article>
                    <article className="cstCard">
                      <p className="eyebrow">MISSIONS LOCALES</p>
                      <h3>{missionCounts.active ?? 0} mission(s) active(s)</h3>
                      <div className="cstRows">
                        <div>
                          <span>Assignées</span>
                          <strong>{missionCounts.assigned ?? 0}</strong>
                        </div>
                        <div>
                          <span>Acceptées</span>
                          <strong>{missionCounts.accepted ?? 0}</strong>
                        </div>
                        <div>
                          <span>En cours</span>
                          <strong>{missionCounts.in_progress ?? 0}</strong>
                        </div>
                        <div>
                          <span>Terminées</span>
                          <strong>{missionCounts.completed ?? 0}</strong>
                        </div>
                        <div>
                          <span>Refusées</span>
                          <strong>{missionCounts.declined ?? 0}</strong>
                        </div>
                      </div>
                    </article>
                  </div>
                )}
              </article>
              <article className="cstCard cstWide" id="professional-accounts">
                <div className="cstModerationHead">
                  <div>
                    <p className="eyebrow">SÉCURITÉ DES ACCÈS</p>
                    <h2>Comptes professionnels approuvés</h2>
                    <p className="cstMuted">
                      Révoquer définitivement un compte mairie, NIGELEC ou NDE compromis. Les
                      signalements et les historiques opérationnels sont conservés.
                    </p>
                  </div>
                  <span className="cstQueueBadge">{professionalAccountsList.length} compte(s)</span>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                  <input
                    className="cstTraceInput"
                    style={{ flex: "1 1 260px" }}
                    value={professionalAccountSearch}
                    onChange={(e) => setProfessionalAccountSearch(e.target.value)}
                    placeholder="Rechercher par organisation, structure ou email…"
                  />
                  <button
                    type="button"
                    className="feedActionButton"
                    disabled={professionalAccountsBusy || professionalAccountActionBusy}
                    onClick={() => void refreshProfessionalAccounts()}
                  >
                    Actualiser
                  </button>
                </div>
                {professionalAccountsBusy && professionalAccountsList.length === 0 ? (
                  <p className="cstMuted">Chargement des comptes approuvés…</p>
                ) : null}
                {professionalAccountsList.filter((a: any) => {
                  const q = professionalAccountSearch.trim().toLowerCase();
                  return (
                    !q ||
                    [a.type, a.name, a.structure, a.region, a.email, a.phone].some((v: any) =>
                      String(v ?? "")
                        .toLowerCase()
                        .includes(q),
                    )
                  );
                }).length === 0 ? (
                  <p className="cstMuted">Aucun compte approuvé correspondant.</p>
                ) : (
                  <div className="cstVideoQueue">
                    {professionalAccountsList
                      .filter((a: any) => {
                        const q = professionalAccountSearch.trim().toLowerCase();
                        return (
                          !q ||
                          [a.type, a.name, a.structure, a.region, a.email, a.phone].some((v: any) =>
                            String(v ?? "")
                              .toLowerCase()
                              .includes(q),
                          )
                        );
                      })
                      .map((a: any) => (
                        <article className="cstVideoReview" key={a.key}>
                          <div className="cstVideoMeta">
                            <div className="cstVideoTitle">
                              <div>
                                <span className="cstQueueBadge">
                                  {a.type === "mairie" ? "MAIRIE" : a.type.toUpperCase()}
                                </span>
                                <h3>{a.name}</h3>
                                <p>
                                  {a.structure}
                                  {a.region ? " · " + a.region : ""}
                                </p>
                              </div>
                              <span className={a.is_active ? "cstQueueBadge" : "cstPendingBadge"}>
                                {a.is_active ? "ACTIF" : "INACTIF"}
                              </span>
                            </div>
                            <dl className="cstMediaFacts">
                              <div>
                                <dt>Email</dt>
                                <dd>{a.email || "Non renseigné"}</dd>
                              </div>
                              <div>
                                <dt>Téléphone</dt>
                                <dd>{a.phone || "—"}</dd>
                              </div>
                              <div>
                                <dt>Approbation</dt>
                                <dd>{a.approval_status}</dd>
                              </div>
                            </dl>
                            <div className="cstVideoActions">
                              <button
                                type="button"
                                className="button cstDangerButton"
                                disabled={professionalAccountActionBusy || !a.is_active}
                                onClick={async () => {
                                  if (
                                    !window.confirm(
                                      "RÉVOCATION DÉFINITIVE DU COMPTE\n\n" +
                                        a.name +
                                        " — " +
                                        a.email +
                                        "\n\nL’identité de connexion sera supprimée et l’accès professionnel révoqué. Les signalements, médias et historiques opérationnels seront conservés. Cette action est irréversible.\n\nConfirmer ?",
                                    )
                                  )
                                    return;
                                  setProfessionalAccountActionBusy(true);
                                  setError("");
                                  try {
                                    await professionalAccounts({
                                      action: "delete_professional_account",
                                      account_type: a.type,
                                      entity_id: a.entity_id,
                                      user_id: a.user_id,
                                    });
                                    await refreshProfessionalAccounts();
                                    window.alert("Compte professionnel supprimé et accès révoqué.");
                                  } catch (e) {
                                    setError(
                                      e instanceof Error
                                        ? e.message
                                        : "Suppression du compte impossible.",
                                    );
                                  } finally {
                                    setProfessionalAccountActionBusy(false);
                                  }
                                }}
                              >
                                Supprimer définitivement le compte
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                  </div>
                )}
              </article>
              <article className="cstCard cstWide" id="mairie-signups">
                <div className="cstModerationHead">
                  <div>
                    <p className="eyebrow">VALIDATION CST</p>
                    <h2>Demandes de comptes mairie</h2>
                    <p className="cstMuted">
                      Le CST est l’autorité de validation. Une mairie reste inactive tant que sa
                      demande n’est pas approuvée.
                    </p>
                  </div>
                  <span className="cstQueueBadge">{mairieRequests.length} en attente</span>
                </div>
                {mairieRequests.length === 0 ? (
                  <p className="cstMuted">Aucune demande mairie en attente.</p>
                ) : (
                  <div className="cstVideoQueue">
                    {mairieRequests.map((r: any) => (
                      <article className="cstVideoReview" key={r.id}>
                        <div className="cstVideoMeta">
                          <div className="cstVideoTitle">
                            <div>
                              <span className="cstPendingBadge">EN ATTENTE</span>
                              <h3>{r.name}</h3>
                              <p>{r.mayor_name || "Responsable non renseigné"}</p>
                            </div>
                            <time>{new Date(r.created_at).toLocaleDateString("fr-FR")}</time>
                          </div>
                          <dl className="cstMediaFacts">
                            <div>
                              <dt>Région</dt>
                              <dd>{r.region_name}</dd>
                            </div>
                            <div>
                              <dt>Localité</dt>
                              <dd>{r.commune_name}</dd>
                            </div>
                            <div>
                              <dt>Téléphone</dt>
                              <dd>{r.phone || "—"}</dd>
                            </div>
                            <div>
                              <dt>Localisation</dt>
                              <dd>{r.location_label || "—"}</dd>
                            </div>
                          </dl>
                          <div className="cstVideoActions">
                            <button
                              type="button"
                              className="button primary"
                              disabled={mairieReviewBusy}
                              onClick={() => void reviewMairieRequest(r.id, true)}
                            >
                              Approuver et activer
                            </button>
                            <button
                              type="button"
                              className="button cstDangerButton"
                              disabled={mairieReviewBusy}
                              onClick={() => void reviewMairieRequest(r.id, false)}
                            >
                              Refuser
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </article>
              <article className="cstCard cstWide" id="org-signups">
                <div className="cstModerationHead">
                  <div>
                    <p className="eyebrow">VALIDATION CST</p>
                    <h2>Demandes de comptes centraux NIGELEC / NDE</h2>
                    <p className="cstMuted">
                      Seul le CST peut approuver ou refuser une demande. L’approbation crée le
                      rattachement organisationnel à la région et à la localité demandées.
                    </p>
                  </div>
                  <span className="cstQueueBadge">{orgRequests.length} en attente</span>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                  <button
                    type="button"
                    className="feedActionButton"
                    disabled={orgReviewBusy}
                    onClick={() =>
                      void refreshOrganizationRequests().catch((e) =>
                        setError(
                          e instanceof Error ? e.message : "Chargement des demandes impossible.",
                        ),
                      )
                    }
                  >
                    Actualiser
                  </button>
                </div>
                {orgRequests.length === 0 ? (
                  <p className="cstMuted">Aucune demande NIGELEC/NDE en attente.</p>
                ) : (
                  <div className="cstVideoQueue">
                    {orgRequests.map((r: any) => (
                      <article className="cstVideoReview" key={r.id}>
                        <div className="cstVideoMeta">
                          <div className="cstVideoTitle">
                            <div>
                              <span className="cstPendingBadge">EN ATTENTE</span>
                              <h3>
                                {r.organization_name} —{" "}
                                {r.structure_name || "Structure non précisée"}
                              </h3>
                              <p>
                                {r.full_name} · {r.email}
                              </p>
                            </div>
                            <time>{new Date(r.created_at).toLocaleDateString("fr-FR")}</time>
                          </div>
                          <dl className="cstMediaFacts">
                            <div>
                              <dt>Région</dt>
                              <dd>{r.region_name || "—"}</dd>
                            </div>
                            <div>
                              <dt>Localité</dt>
                              <dd>{r.commune_name || "—"}</dd>
                            </div>
                            <div>
                              <dt>Téléphone</dt>
                              <dd>{r.phone || "—"}</dd>
                            </div>
                            <div>
                              <dt>Code organisation</dt>
                              <dd>{r.organization_code || "—"}</dd>
                            </div>
                          </dl>
                          {orgRejectingId === r.id ? (
                            <div className="cstRejectBox">
                              <label>
                                Motif du refus
                                <textarea
                                  value={orgRejectNote}
                                  onChange={(e) => setOrgRejectNote(e.target.value)}
                                  minLength={5}
                                  maxLength={1000}
                                  placeholder="Expliquez le motif du refus (5 caractères minimum)."
                                />
                              </label>
                              <div className="cstVideoActions">
                                <button
                                  type="button"
                                  className="button"
                                  disabled={orgReviewBusy}
                                  onClick={() => {
                                    setOrgRejectingId("");
                                    setOrgRejectNote("");
                                  }}
                                >
                                  Annuler
                                </button>
                                <button
                                  type="button"
                                  className="button cstDangerButton"
                                  disabled={orgReviewBusy || orgRejectNote.trim().length < 5}
                                  onClick={() => void reviewOrganizationRequest(r.id, false)}
                                >
                                  {orgReviewBusy ? "Traitement…" : "Confirmer le refus"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="cstVideoActions">
                              <button
                                type="button"
                                className="button primary"
                                disabled={orgReviewBusy}
                                onClick={() => void reviewOrganizationRequest(r.id, true)}
                              >
                                Approuver et activer le compte central
                              </button>
                              <button
                                type="button"
                                className="button cstDangerButton"
                                disabled={orgReviewBusy}
                                onClick={() => {
                                  setOrgRejectingId(r.id);
                                  setOrgRejectNote("");
                                }}
                              >
                                Refuser
                              </button>
                            </div>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </article>
              <article className="cstCard cstWide" id="archives">
                <div className="cstModerationHead">
                  <div>
                    <p className="eyebrow">ARCHIVES VIDÉO</p>
                    <h2>Vidéos de résolution archivées</h2>
                    <p className="cstMuted">
                      Accès réservé au compte CST. Les liens de lecture sont temporaires et les
                      vidéos restent dans le stockage privé central.
                    </p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                      <button
                        type="button"
                        className="feedActionButton"
                        disabled={archivesBusy}
                        onClick={async () => {
                          try {
                            const result = await cleanupExpiredArchives(true);
                            window.alert(
                              result.count +
                                " archive(s) arrivée(s) à échéance. Aucune vidéo n’a été supprimée.",
                            );
                          } catch (e) {
                            setError(e instanceof Error ? e.message : "Vérification impossible.");
                          }
                        }}
                      >
                        Vérifier les archives échues
                      </button>
                      <button
                        type="button"
                        className="feedActionButton"
                        disabled={archivesBusy}
                        onClick={async () => {
                          const ok = window.confirm(
                            "Supprimer définitivement du stockage les vidéos échues sans gel audit/litige ? Cette action est irréversible.",
                          );
                          if (!ok) return;
                          try {
                            const preview = await cleanupExpiredArchives(true);
                            if (preview.count === 0) {
                              window.alert("Aucune archive échue à supprimer.");
                              return;
                            }
                            const result = await cleanupExpiredArchives(false);
                            window.alert(
                              result.processed +
                                " archive(s) traitée(s). Consultez le journal en cas d’échec.",
                            );
                            const refreshed = await listVideoArchives();
                            setArchives(refreshed.items ?? []);
                          } catch (e) {
                            setError(e instanceof Error ? e.message : "Nettoyage impossible.");
                          }
                        }}
                      >
                        Nettoyer les archives échues
                      </button>
                    </div>
                  </div>
                  <span className="cstQueueBadge">{archives.length} archive(s)</span>
                </div>
                <label className="cstTraceSearchLabel">
                  Rechercher une référence, un titre ou un lieu
                  <input
                    className="cstTraceInput"
                    value={archiveSearch}
                    onChange={(e) => setArchiveSearch(e.target.value)}
                    placeholder="Référence, titre, localisation…"
                  />
                </label>
                {archivesBusy && archives.length === 0 ? (
                  <p className="cstMuted">Chargement des archives…</p>
                ) : null}
                {archives.filter((v: any) => {
                  const q = archiveSearch.trim().toLowerCase();
                  return (
                    !q ||
                    [v.report?.reference_code, v.report?.title, v.report?.location_label].some(
                      (x: any) =>
                        String(x ?? "")
                          .toLowerCase()
                          .includes(q),
                    )
                  );
                }).length === 0 ? (
                  <p className="cstMuted cstEmptyModeration">
                    Aucune vidéo de résolution archivée ne correspond à la recherche.
                  </p>
                ) : (
                  <div className="cstVideoQueue">
                    {archives
                      .filter((v: any) => {
                        const q = archiveSearch.trim().toLowerCase();
                        return (
                          !q ||
                          [
                            v.report?.reference_code,
                            v.report?.title,
                            v.report?.location_label,
                          ].some((x: any) =>
                            String(x ?? "")
                              .toLowerCase()
                              .includes(q),
                          )
                        );
                      })
                      .map((v: any) => (
                        <article className="cstVideoReview" key={v.id}>
                          <div className="cstVideoPreview">
                            {v.preview_url ? (
                              <video
                                controls
                                preload="metadata"
                                playsInline
                                style={{
                                  display: "block",
                                  width: "100%",
                                  aspectRatio: "16 / 9",
                                  height: "auto",
                                  maxHeight: "360px",
                                  objectFit: "contain",
                                  background: "#111",
                                }}
                                src={v.preview_url}
                              />
                            ) : (
                              <div className="cstVideoUnavailable">
                                Aperçu temporairement indisponible
                              </div>
                            )}
                          </div>
                          <div className="cstVideoMeta">
                            <div className="cstVideoTitle">
                              <div>
                                <span className="cstPendingBadge">ARCHIVE CST</span>
                                <h3>{v.report?.reference_code ?? "Signalement"}</h3>
                                <p>{v.report?.title ?? "Vidéo de résolution"}</p>
                              </div>
                              <time>{new Date(v.archived_at).toLocaleDateString("fr-FR")}</time>
                            </div>
                            <dl className="cstMediaFacts">
                              <div>
                                <dt>Lieu</dt>
                                <dd>{v.report?.location_label ?? "Non renseigné"}</dd>
                              </div>
                              <div>
                                <dt>Taille</dt>
                                <dd>
                                  {v.report_media?.file_size
                                    ? Math.round((v.report_media.file_size / 1024 / 1024) * 10) /
                                        10 +
                                      " Mo"
                                    : v.file_size
                                      ? Math.round((v.file_size / 1024 / 1024) * 10) / 10 + " Mo"
                                      : "—"}
                                </dd>
                              </div>
                              <div>
                                <dt>Conservée jusqu’au</dt>
                                <dd>{new Date(v.expires_at).toLocaleDateString("fr-FR")}</dd>
                              </div>
                              <div>
                                <dt>État</dt>
                                <dd>
                                  {v.hold_reason
                                    ? "Conservation prolongée"
                                    : "Conservation standard"}
                                </dd>
                              </div>
                            </dl>
                            <div
                              style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}
                            >
                              {v.hold_reason ? (
                                <button
                                  type="button"
                                  className="feedActionButton"
                                  onClick={async () => {
                                    try {
                                      await setArchiveHold(v.id, "release");
                                      const refreshed = await listVideoArchives();
                                      setArchives(refreshed.items ?? []);
                                    } catch (e) {
                                      setError(
                                        e instanceof Error
                                          ? e.message
                                          : "Impossible de rétablir l’échéance.",
                                      );
                                    }
                                  }}
                                >
                                  Rétablir la conservation de 12 mois
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="feedActionButton"
                                  onClick={async () => {
                                    const reason = window.prompt(
                                      "Motif d’audit ou de litige justifiant le gel de suppression :",
                                    );
                                    if (!reason?.trim()) return;
                                    try {
                                      await setArchiveHold(v.id, "hold", reason.trim());
                                      const refreshed = await listVideoArchives();
                                      setArchives(refreshed.items ?? []);
                                    } catch (e) {
                                      setError(
                                        e instanceof Error
                                          ? e.message
                                          : "Impossible de protéger cette archive.",
                                      );
                                    }
                                  }}
                                >
                                  Prolonger pour audit / litige
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      ))}
                  </div>
                )}
              </article>
              <article className="cstCard cstWide" id="report-management">
                <div className="cstModerationHead">
                  <div>
                    <p className="eyebrow">ADMINISTRATION DES SIGNALEMENTS</p>
                    <h2>Archiver ou supprimer un signalement</h2>
                    <p className="cstMuted">
                      Choisissez un signalement. Les médias et leur validation restent uniquement
                      dans l’espace de modération dédié.
                    </p>
                  </div>
                  <span className="cstQueueBadge">{reports.length} signalement(s)</span>
                </div>
                <div className="cstReportFilters">
                  <input
                    className="cstTraceInput"
                    value={reportSearch}
                    onChange={(e) => setReportSearch(e.target.value)}
                    placeholder="Référence, titre ou localisation…"
                  />
                  <select
                    className="cstTraceInput"
                    value={reportRegionFilter}
                    onChange={(e) => setReportRegionFilter(e.target.value)}
                  >
                    <option value="">Toutes les régions</option>
                    {regions.map((region: any) => (
                      <option key={region.id} value={region.id}>
                        {region.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="feedActionButton"
                    disabled={reportsBusy || reportActionBusy}
                    onClick={async () => {
                      setReportsBusy(true);
                      try {
                        const result = await reportManagement({ action: "list" });
                        setReports(result.items ?? []);
                      } catch (e) {
                        setError(
                          e instanceof Error
                            ? e.message
                            : "Chargement des signalements impossible.",
                        );
                      } finally {
                        setReportsBusy(false);
                      }
                    }}
                  >
                    Actualiser
                  </button>
                </div>
                {reportsBusy && reports.length === 0 ? (
                  <p className="cstMuted">Chargement des signalements…</p>
                ) : null}
                {reports.filter((r: any) => {
                  const q = reportSearch.trim().toLowerCase();
                  const matchesSearch =
                    !q ||
                    [r.reference_code, r.title, r.location_label, r.status, r.regions?.name].some(
                      (v: any) =>
                        String(v ?? "")
                          .toLowerCase()
                          .includes(q),
                    );
                  const matchesRegion = !reportRegionFilter || r.region_id === reportRegionFilter;
                  return matchesSearch && matchesRegion;
                }).length === 0 ? (
                  <p className="cstMuted">Aucun signalement ne correspond à la recherche.</p>
                ) : (
                  <div className="cstReportList">
                    {reports
                      .filter((r: any) => {
                        const q = reportSearch.trim().toLowerCase();
                        const matchesSearch =
                          !q ||
                          [
                            r.reference_code,
                            r.title,
                            r.location_label,
                            r.status,
                            r.regions?.name,
                          ].some((v: any) =>
                            String(v ?? "")
                              .toLowerCase()
                              .includes(q),
                          );
                        const matchesRegion =
                          !reportRegionFilter || r.region_id === reportRegionFilter;
                        return matchesSearch && matchesRegion;
                      })
                      .map((r: any) => (
                        <article className="cstReportRow" key={r.id}>
                          <div className="cstReportIdentity">
                            <strong>{r.reference_code || "Signalement"}</strong>
                            <span>{r.title || "Sans titre"}</span>
                          </div>
                          <div className="cstReportDetails">
                            <span>{r.regions?.name || "Région non renseignée"}</span>
                            <span>{r.location_label || "Localité non renseignée"}</span>
                            <span>{r.status}</span>
                            <span>{new Date(r.created_at).toLocaleDateString("fr-FR")}</span>
                            <span className={r.archived_at ? "cstPendingBadge" : "cstQueueBadge"}>
                              {r.archived_at ? "ARCHIVÉ" : "ACTIF"}
                            </span>
                          </div>
                          <div className="cstReportActions">
                            {r.archived_at ? (
                              <button
                                type="button"
                                className="button primary"
                                disabled={reportActionBusy}
                                onClick={async () => {
                                  if (
                                    !window.confirm(
                                      "Restaurer ce signalement et le rendre de nouveau éligible à l’accueil public ?",
                                    )
                                  )
                                    return;
                                  setReportActionBusy(true);
                                  try {
                                    await reportManagement({ action: "restore", report_id: r.id });
                                    const result = await reportManagement({ action: "list" });
                                    setReports(result.items ?? []);
                                  } catch (e) {
                                    setError(
                                      e instanceof Error ? e.message : "Restauration impossible.",
                                    );
                                  } finally {
                                    setReportActionBusy(false);
                                  }
                                }}
                              >
                                Restaurer
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="button"
                                disabled={reportActionBusy}
                                onClick={async () => {
                                  if (
                                    !window.confirm(
                                      "Archiver ce signalement ? Il sera masqué de l’accueil public, mais ses données et médias seront conservés.",
                                    )
                                  )
                                    return;
                                  setReportActionBusy(true);
                                  try {
                                    await reportManagement({ action: "archive", report_id: r.id });
                                    const result = await reportManagement({ action: "list" });
                                    setReports(result.items ?? []);
                                  } catch (e) {
                                    setError(
                                      e instanceof Error ? e.message : "Archivage impossible.",
                                    );
                                  } finally {
                                    setReportActionBusy(false);
                                  }
                                }}
                              >
                                Archiver
                              </button>
                            )}
                            <button
                              type="button"
                              className="button cstDangerButton"
                              disabled={reportActionBusy}
                              onClick={async () => {
                                if (
                                  !window.confirm(
                                    "SUPPRESSION DÉFINITIVE\n\nCe signalement, ses photos, vidéos, commentaires, confirmations, affectations et historiques seront supprimés. Cette opération est irréversible.\n\nConfirmer la suppression ?",
                                  )
                                )
                                  return;
                                setReportActionBusy(true);
                                try {
                                  await reportManagement({ action: "delete", report_id: r.id });
                                  setReports((items) => items.filter((item) => item.id !== r.id));
                                  window.alert("Signalement et médias associés supprimés.");
                                } catch (e) {
                                  setError(
                                    e instanceof Error ? e.message : "Suppression impossible.",
                                  );
                                } finally {
                                  setReportActionBusy(false);
                                }
                              }}
                            >
                              Supprimer
                            </button>
                          </div>
                        </article>
                      ))}
                  </div>
                )}
              </article>
              <article className="cstCard cstWide cstModerationCard" id="moderation">
                <div className="cstModerationHead">
                  <div>
                    <p className="eyebrow">MODÉRATION DES PREUVES</p>
                    <h2>Photos et vidéos en attente</h2>
                    <p className="cstMuted">
                      Toutes les photos et vidéos de preuve envoyées par les citoyens restent
                      privées jusqu’à la décision du CST ou du modérateur régional autorisé. Le CST
                      conserve une visibilité globale ; les modérateurs régionaux restent limités à
                      leur région. Les vidéos de résolution des agents restent hors de cette file.
                    </p>
                  </div>
                  <span className="cstQueueBadge">{mediaQueue.length} en attente</span>
                </div>
                {mediaQueue.length === 0 ? (
                  <p className="cstMuted cstEmptyModeration">
                    Aucune photo ou vidéo en attente de modération.
                  </p>
                ) : (
                  <div className="cstVideoQueue">
                    {mediaQueue.map((v: any) => (
                      <article className="cstVideoReview" key={v.id}>
                        <div className="cstVideoPreview">
                          {v.preview_url ? (
                            String(v.media_type ?? "").startsWith("image/") ? (
                              <img
                                src={v.preview_url}
                                alt={
                                  "Photo de preuve du signalement " +
                                  (v.report?.reference_code ?? "")
                                }
                                loading="lazy"
                                style={{
                                  display: "block",
                                  width: "100%",
                                  maxHeight: "360px",
                                  objectFit: "contain",
                                  background: "#111",
                                }}
                              />
                            ) : (
                              <video
                                controls
                                preload="metadata"
                                playsInline
                                style={{
                                  display: "block",
                                  width: "100%",
                                  aspectRatio: "16 / 9",
                                  height: "auto",
                                  maxHeight: "360px",
                                  objectFit: "contain",
                                  background: "#111",
                                }}
                                src={v.preview_url}
                              />
                            )
                          ) : (
                            <div className="cstVideoUnavailable">Aperçu indisponible</div>
                          )}
                        </div>
                        <div className="cstVideoMeta">
                          <div className="cstVideoTitle">
                            <div>
                              <span className="cstPendingBadge">EN ATTENTE</span>
                              <h3>{v.report?.reference_code ?? "Signalement"}</h3>
                              <p>{v.report?.title ?? "Vidéo de signalement"}</p>
                            </div>
                            <time>{new Date(v.created_at).toLocaleString("fr-FR")}</time>
                          </div>
                          <dl className="cstMediaFacts">
                            <div>
                              <dt>Localisation</dt>
                              <dd>{v.report?.location_label ?? "Non renseignée"}</dd>
                            </div>
                            <div>
                              <dt>Taille</dt>
                              <dd>
                                {v.file_size
                                  ? Math.round((v.file_size / 1024 / 1024) * 10) / 10 + " Mo"
                                  : "—"}
                              </dd>
                            </div>
                            <div>
                              <dt>GPS capture</dt>
                              <dd>
                                {String(v.media_type ?? "").startsWith("image/")
                                  ? "Photo de preuve citoyenne"
                                  : v.media_role === "citizen_evidence"
                                    ? "Preuve vidéo citoyenne"
                                    : "Non renseigné"}
                              </dd>
                            </div>
                            <div>
                              <dt>Publication</dt>
                              <dd>
                                {v.report?.is_public
                                  ? "Signalement public"
                                  : "Signalement non public"}
                              </dd>
                            </div>
                          </dl>
                          {rejectingId === v.id ? (
                            <div className="cstRejectBox">
                              <label>
                                Motif du rejet
                                <textarea
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
                                  minLength={5}
                                  maxLength={500}
                                  placeholder="Expliquez clairement pourquoi ce média est non conforme."
                                />
                              </label>
                              <div className="cstVideoActions">
                                <button
                                  className="button"
                                  disabled={mediaBusy}
                                  onClick={() => {
                                    setRejectingId("");
                                    setRejectReason("");
                                  }}
                                >
                                  Annuler
                                </button>
                                <button
                                  className="button cstDangerButton"
                                  disabled={mediaBusy || rejectReason.trim().length < 5}
                                  onClick={() => void rejectMedia(v.id)}
                                >
                                  {mediaBusy ? "Traitement…" : "Confirmer le rejet et supprimer"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="cstVideoActions">
                              <button
                                className="button primary"
                                disabled={mediaBusy}
                                onClick={() => void approveMedia(v.id)}
                              >
                                ✓ Approuver et publier
                              </button>
                              <button
                                className="button cstDangerButton"
                                disabled={mediaBusy}
                                onClick={() => {
                                  setRejectingId(v.id);
                                  setRejectReason("");
                                  setError("");
                                }}
                              >
                                ✕ Rejeter / supprimer
                              </button>
                            </div>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </article>
            </div>
          </section>
        )}
        {techOpen && (
          <section className="cstAdvancedArea cstTechArea" id="cst-tech">
            <div className="cstAdvancedHeading">
              <div>
                <p className="eyebrow">SUPERVISION TECHNIQUE</p>
                <h2>API, requêtes et infrastructure</h2>
                <p>Informations techniques réservées au CST.</p>
              </div>
              <button type="button" className="button" onClick={() => setTechOpen(false)}>
                Masquer
              </button>
            </div>
            <div className="cstSectionGrid">
              <article className="cstCard cstWide" id="overview">
                <p className="eyebrow">SYSTEM MAP</p>
                <h2>Architecture observée</h2>
                <div className="cstFlow">
                  {[
                    "Utilisateur",
                    "Frontend",
                    "API / Supabase",
                    "Backend / Edge Functions",
                    "Database",
                  ].map((x, i) => (
                    <div className="cstFlowNode" key={x}>
                      <strong>{x}</strong>
                      <span>
                        <Dot s={i === 4 ? (db?.status ?? "offline") : "healthy"} />
                        {i === 4 ? (db?.latency_ms ?? "—") + " ms" : "Source raccordée"}
                      </span>
                      {i < 4 && <b>↓</b>}
                    </div>
                  ))}
                </div>
                <p className="cstMuted">
                  Le CST n’invente pas de statut pour les composants dont la source de métriques
                  n’est pas encore raccordée.
                </p>
              </article>
              <article className="cstCard cstWide" id="requests">
                <p className="eyebrow">LIVE REQUESTS</p>
                <h2>Flux des requêtes</h2>
                {requests.length ? (
                  <div className="cstTableWrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Heure</th>
                          <th>Méthode</th>
                          <th>Endpoint</th>
                          <th>Status</th>
                          <th>Latence</th>
                          <th>Trace ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {requests.slice(0, 40).map((r: any) => (
                          <tr key={r.id}>
                            <td>{new Date(r.occurred_at).toLocaleTimeString("fr-FR")}</td>
                            <td>
                              <code>{r.method}</code>
                            </td>
                            <td>{r.endpoint}</td>
                            <td>
                              <span
                                className={
                                  Number(r.status_code) >= 400 ? "cstHttpError" : "cstHttpOk"
                                }
                              >
                                {r.status_code || "ERR"}
                              </span>
                            </td>
                            <td>{r.latency_ms ?? "—"} ms</td>
                            <td>
                              <code>{r.trace_id}</code>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="cstMuted">
                    Aucune requête observée sur la fenêtre actuelle. Le flux se remplira dès qu’une
                    session PCS effectuera des requêtes depuis le navigateur.
                  </p>
                )}
              </article>
              <article className="cstCard cstWide" id="apis">
                <p className="eyebrow">API MONITORING</p>
                <h2>Endpoints réellement observés</h2>
                {api.length ? (
                  <div className="cstTableWrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Méthode</th>
                          <th>Endpoint</th>
                          <th>Requêtes</th>
                          <th>Latence</th>
                          <th>Erreurs</th>
                          <th>Dernière activité</th>
                        </tr>
                      </thead>
                      <tbody>
                        {api.map((a: any) => (
                          <tr key={a.method + " " + a.endpoint}>
                            <td>{a.method}</td>
                            <td>{a.endpoint}</td>
                            <td>{a.requests}</td>
                            <td>{a.avg_latency_ms ?? "—"} ms</td>
                            <td>{a.error_rate}%</td>
                            <td>{new Date(a.last_activity).toLocaleTimeString("fr-FR")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="cstMuted">{unavailable}. Aucun endpoint n’a encore été observé.</p>
                )}
              </article>
              <article className="cstCard" id="frontend">
                <p className="eyebrow">FRONTEND MONITORING</p>
                <h2>{frontend.length ? "Événements détectés" : "Aucune erreur détectée"}</h2>
                {frontend.length ? (
                  <div className="cstEventList">
                    {frontend.slice(0, 20).map((e: any) => (
                      <div key={e.id}>
                        <strong>{e.event_type}</strong>
                        <span>{e.message || "—"}</span>
                        <small>
                          {e.page || "—"} · {new Date(e.occurred_at).toLocaleTimeString("fr-FR")}
                        </small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="cstMuted">
                    Aucun événement JavaScript ou rejet non géré observé sur les 15 dernières
                    minutes.
                  </p>
                )}
              </article>
              <article className="cstCard" id="backend">
                <p className="eyebrow">BACKEND MONITORING</p>
                <h2>
                  {data?.connected_sources?.backend_metrics ? "Connecté" : "Source non connectée"}
                </h2>
                <p className="cstMuted">
                  Les métriques d’exécution détaillées des Edge Functions nécessitent le
                  raccordement de la source de logs/metrics de la plateforme.
                </p>
              </article>
              <article className="cstCard" id="database">
                <p className="eyebrow">DATABASE MONITORING</p>
                <h2>Supabase PostgreSQL</h2>
                <div className="cstRows">
                  <div>
                    <span>Disponibilité</span>
                    <strong>{db?.status === "healthy" ? "Healthy" : "Degraded"}</strong>
                  </div>
                  <div>
                    <span>Latence</span>
                    <strong>{db?.latency_ms ?? "—"} ms</strong>
                  </div>
                  <div>
                    <span>Connexions</span>
                    <strong>
                      {db?.connections ?? "—"} / {db?.max_connections ?? "—"}
                    </strong>
                  </div>
                  <div>
                    <span>Saturation</span>
                    <strong>
                      {db?.connection_utilization_percent != null
                        ? db.connection_utilization_percent + " %"
                        : unavailable}
                    </strong>
                  </div>
                  <div>
                    <span>Taille DB</span>
                    <strong>
                      {db?.database_size_bytes
                        ? Math.round(db.database_size_bytes / 1024 / 1024) + " MB"
                        : unavailable}
                    </strong>
                  </div>
                </div>
              </article>
              <article className="cstCard cstWide" id="traces">
                <p className="eyebrow">TRACE EXPLORER</p>
                <h2>Recherche par Trace ID</h2>
                <input
                  className="cstTraceInput"
                  value={traceFilter}
                  onChange={(e) => setTraceFilter(e.target.value)}
                  placeholder="trace_…"
                />
                {traces.length ? (
                  <div className="cstTableWrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Trace ID</th>
                          <th>Endpoint</th>
                          <th>Status</th>
                          <th>Latence</th>
                          <th>Horodatage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {traces.map((r: any) => (
                          <tr key={"t" + r.id}>
                            <td>
                              <code>{r.trace_id}</code>
                            </td>
                            <td>{r.endpoint}</td>
                            <td>{r.status_code || "ERR"}</td>
                            <td>{r.latency_ms ?? "—"} ms</td>
                            <td>{new Date(r.occurred_at).toLocaleString("fr-FR")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="cstMuted">Aucune trace correspondant au filtre.</p>
                )}
              </article>
              <article className="cstCard cstWide" id="logs">
                <p className="eyebrow">LOG EXPLORER</p>
                <h2>Logs applicatifs</h2>
                <p className="cstMuted">
                  Source plateforme non connectée dans l’application. Les événements frontend et les
                  requêtes observées sont disponibles dans les modules dédiés, sans présenter de
                  faux logs.
                </p>
              </article>
              <article className="cstCard" id="alerts">
                <p className="eyebrow">ALERTS</p>
                <h2>{alerts.length ? "Alertes actives" : "Aucune alerte active"}</h2>
                {alerts.length ? (
                  <div className="cstEventList">
                    {alerts.map((a: any) => (
                      <div key={a.title} className="cstAlertRow">
                        <strong>{a.title}</strong>
                        <span>{a.detail}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="cstMuted">
                    Seuils surveillés : erreur &gt; 5 %, latence &gt; 1000 ms, connexions DB &gt; 80
                    %.
                  </p>
                )}
              </article>
              <article className="cstCard" id="incidents">
                <p className="eyebrow">INCIDENTS</p>
                <h2>Historique</h2>
                <p className="cstMuted">
                  Aucune base d’incidents dédiée n’est encore raccordée. Les alertes calculées
                  restent visibles tant qu’elles sont actives.
                </p>
              </article>
            </div>
          </section>
        )}
      </main>
    </section>
  );
}
