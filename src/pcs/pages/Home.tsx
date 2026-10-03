import { useEffect, useRef, useState } from "react";
import { Link } from "@/pcs/router";
import { supabase } from "../lib/supabase";
import { listPublicReports } from "../lib/reports";
import type { PublicReport } from "../types";
import { statusLabels } from "../types";
import { createReportMediaUrl } from "../services/media";
import BrandLogo from "../components/BrandLogo";
import { MediaCarousel } from "../components/MediaCarousel";

export default function Home() {
  const [reports, setReports] = useState<PublicReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [headerHidden, setHeaderHidden] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let lastRefreshAt = 0;
    const refreshReports = async (force = false) => {
      // Avoid overlapping requests when the timer, tab visibility and window focus
      // fire close together. A short cooldown also prevents duplicate focus events.
      const now = Date.now();
      if (inFlight || (!force && now - lastRefreshAt < 5000)) return;
      inFlight = true;
      lastRefreshAt = now;
      try {
        const nextReports = await listPublicReports();
        if (active) {
          setReports(nextReports);
          setError("");
        }
      } catch (error) {
        if (active) setError(error instanceof Error ? error.message : "Impossible de charger les signalements publics.");
      } finally {
        inFlight = false;
        if (active) setLoading(false);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshReports();
    };
    void refreshReports(true);
    const timer = window.setInterval(() => void refreshReports(), 30000);
    window.addEventListener("focus", onVisibility);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onVisibility);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    const feed = document.querySelector<HTMLElement>(".citizenFeed");
    if (!feed) return;

    const resetHomePosition = () => {
      setHeaderHidden(false);
      setHeaderScrolled(false);
      feed.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.querySelector<HTMLElement>("main")?.scrollTo({ top: 0, left: 0, behavior: "auto" });
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      feed.querySelector<HTMLElement>(".citizenSlideIntro")?.scrollIntoView({
        block: "start",
        behavior: "auto",
      });
      feed.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };

    // On entering the home route, always begin at the report-entry slide.
    resetHomePosition();
    window.addEventListener("pcs-home-reset", resetHomePosition);

    let lastScrollTop = feed.scrollTop;

    const onScroll = () => {
      const current = Math.max(0, feed.scrollTop);
      setHeaderScrolled(current > 8);

      if (current <= 8) {
        setHeaderHidden(false);
      } else if (current > lastScrollTop + 2) {
        setHeaderHidden(true);
      } else if (current < lastScrollTop - 2) {
        setHeaderHidden(false);
      }

      lastScrollTop = current;
    };

    feed.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("pcs-home-reset", resetHomePosition);
      feed.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <section className="citizenFeed">
      <div
        className={`citizenFeedTop${headerHidden ? " headerHidden" : ""}${headerScrolled ? " headerScrolled" : ""}`}
      >
        <Link
          className="feedBrand"
          data-pcs-tour="home"
          to="/"
          aria-label="Accueil — revenir au début du flux"
          onClick={(event) => {
            // This is an in-page control, not a route change. Prevent router
            // scroll restoration from racing with the feed reset.
            event.preventDefault();
            const feed = document.querySelector<HTMLElement>(".citizenFeed");
            const intro = feed?.querySelector<HTMLElement>(".citizenSlideIntro");

            setHeaderHidden(false);
            setHeaderScrolled(false);

            // Reset both possible scroll containers: the feed itself and the
            // document. scrollIntoView is a final fallback for mobile layouts.
            feed?.scrollTo({ top: 0, left: 0, behavior: "auto" });
            window.scrollTo({ top: 0, left: 0, behavior: "auto" });
            intro?.scrollIntoView({ block: "start", behavior: "smooth" });
          }}
        >
          <BrandLogo className="feedBrandLogo" />
        </Link>

        <div className="feedTabs">
          <span className="active">Tous les signalements</span>
        </div>

        <details className="feedAccess" data-pcs-tour="professional-access">
          <summary>
            <span className="feedAccessIcon">◈</span>
            <span>Espace professionnel</span>
            <span className="feedAccessChevron">▾</span>
          </summary>
          <div>
            {/* Keep professional navigation inside the PCS router so the selected
                login screen opens without a full document reload. */}
            <Link to="/cst">🖥️ CST — Supervision technique</Link>
            <Link to="/connexion-operationnelle">🏛️ Mairie</Link>
            <Link to="/connexion-operationnelle?mode=agent">
              👷 Agent terrain
            </Link>
            <Link to="/connexion-operationnelle?mode=moderator">
              🛡️ Modérateur
            </Link>
            <Link to="/connexion-nigelec">⚡ NIGELEC</Link>
            <Link to="/connexion-nde">💧 NDE</Link>
          </div>
        </details>
      </div>

      <article className="citizenSlide citizenSlideIntro">
        <div className="slideShade" />
        <div className="slideContent">
          <p className="eyebrow feedEyebrow">PLATEFORME CITOYENNE</p>
          <h1>
            Les problèmes publics,
            <br />
            <strong>visibles et suivis.</strong>
          </h1>
          <p>
            Parcourez les signalements publiés dans tout le Niger, suivez leur
            évolution et consultez les résolutions.
          </p>
          <div className="feedActions">
            <Link
              className="feedPrimary"
              data-pcs-tour="create-report"
              to="/signaler"
            >
              ＋ Signaler un problème
            </Link>
          </div>
        </div>
      </article>

      {error && (
        <article className="citizenSlide">
          <div className="slideContent">
            <p className="error">{error}</p>
          </div>
        </article>
      )}

      {loading && (
        <article className="citizenSlide">
          <div className="slideContent">
            <p>Chargement des signalements…</p>
          </div>
        </article>
      )}

      {!loading && reports.length === 0 && !error && (
        <article className="citizenSlide">
          <div className="slideContent">
            <h2>Aucun signalement public pour le moment.</h2>
            <p>
              Les signalements publiés apparaîtront ici au fur et à mesure.
            </p>
          </div>
        </article>
      )}

      {reports.map((report) => (
        <PublicReportSlide key={report.id} report={report} />
      ))}
    </section>
  );
}

function PublicReportSlide({ report }: { report: PublicReport }) {
  const [media, setMedia] = useState<
    { id: string; url: string; media_role: string; media_type: string }[]
  >([]);
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaRefresh, setMediaRefresh] = useState(0);
  const [visitorToken, setVisitorToken] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [publicComments, setPublicComments] = useState<{ id: string; display_name: string | null; body: string; created_at: string }[]>([]);
  const [confirmationCount, setConfirmationCount] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [interactionBusy, setInteractionBusy] = useState(false);
  const [interactionMessage, setInteractionMessage] = useState("");
  const slideRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!mediaReady) return;
    // Signed media URLs are valid for one hour; refresh every 45 minutes rather
    // than querying Storage every 30 seconds for every visible report.
    let lastRefreshAt = Date.now();
    const refreshIfStale = () => {
      if (Date.now() - lastRefreshAt < 45 * 60 * 1000) return;
      lastRefreshAt = Date.now();
      setMediaRefresh((value) => value + 1);
    };
    const timer = window.setInterval(refreshIfStale, 60 * 1000);
    window.addEventListener("focus", refreshIfStale);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshIfStale);
    };
  }, [mediaReady]);

  useEffect(() => {
    const slide = slideRef.current;
    if (!slide || !supabase || !report.id) {
      setMedia([]);
      return;
    }

    if (!("IntersectionObserver" in window)) {
      setMediaReady(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setMediaReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: "700px 0px", threshold: 0 },
    );

    observer.observe(slide);
    return () => observer.disconnect();
  }, [report.id]);

  useEffect(() => {
    if (!mediaReady || !supabase || !report.id) return;

    let cancelled = false;
    const reportId = report.id;

    void (async () => {
      try {
        const { data, error } = await supabase
          .from("public_report_media")
          .select("id,storage_path,media_role,media_type")
          .eq("report_id", reportId)
          .order("created_at", { ascending: true });

        if (error) throw error;

        const urls = await Promise.all(
          (data ?? [])
            .filter((item) => item.id && item.storage_path)
            .map(async (item) => ({
              id: item.id as string,
              url: await createReportMediaUrl(item.storage_path as string),
              media_role: item.media_role ?? "evidence",
              media_type: item.media_type ?? "image",
            })),
        );

        if (!cancelled) {
          setMedia(
            urls.sort((a, b) => {
              const aIsVideo =
                a.media_type.startsWith("video") ||
                a.media_role === "resolution_video";
              const bIsVideo =
                b.media_type.startsWith("video") ||
                b.media_role === "resolution_video";
              return Number(bIsVideo) - Number(aIsVideo);
            }),
          );
        }
      } catch {
        if (!cancelled) setMedia([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mediaReady, mediaRefresh, report.id]);


  useEffect(() => {
    if (!report.id) return;
    const storageKey = "pcs-citizen-token";
    const createToken = () => {
      // randomUUID n'est pas disponible dans certains navigateurs embarqués.
      if (typeof window.crypto?.randomUUID === "function") return window.crypto.randomUUID();
      if (typeof window.crypto?.getRandomValues === "function") {
        const bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      }
      throw new Error("Ce navigateur ne permet pas de créer un identifiant sécurisé.");
    };
    let token = "";
    try {
      token = window.localStorage.getItem(storageKey) ?? "";
      if (!token) {
        token = createToken();
        window.localStorage.setItem(storageKey, token);
      }
    } catch {
      try { token = createToken(); } catch { token = ""; }
    }
    setVisitorToken(token || null);
    if (!token) setInteractionMessage("Activez un navigateur sécurisé pour confirmer ce signalement.");
  }, [report.id]);

  useEffect(() => {
    if (!supabase || !report.id || !visitorToken) return;
    let cancelled = false;
    void (async () => {
      const { data: reaction, error: reactionError } = await supabase.rpc("get_public_report_confirmation", {
        p_report_id: report.id!,
        p_visitor_token: visitorToken!,
      });
      if (reactionError) throw reactionError;
      if (!cancelled && reaction && typeof reaction === "object") {
        const result = reaction as { confirmed?: boolean; count?: number };
        setConfirmed(Boolean(result.confirmed));
        setConfirmationCount(Number(result.count ?? 0));
      }
      const { data: comments, error: commentsError } = await supabase.rpc("list_public_report_comments", {
        p_report_id: report.id!,
      });
      if (commentsError) throw commentsError;
      if (!cancelled) setPublicComments((comments ?? []) as { id: string; display_name: string | null; body: string; created_at: string }[]);
    })().catch(() => {
      if (!cancelled) setInteractionMessage("Les interactions sont temporairement indisponibles.");
    });
    return () => { cancelled = true; };
  }, [report.id, visitorToken]);

  const toggleConfirmation = async () => {
    if (!supabase || !report.id || !visitorToken) {
      setInteractionMessage("Impossible de créer votre identifiant citoyen. Rechargez la page puis réessayez.");
      return;
    }
    setInteractionBusy(true);
    setInteractionMessage("");
    try {
      const { data, error } = await supabase.rpc("toggle_public_report_confirmation", {
        p_report_id: report.id!,
        p_visitor_token: visitorToken,
      });
      if (error) throw error;
      const result = data as { confirmed?: boolean; count?: number } | null;
      if (!result || typeof result.confirmed !== "boolean" || typeof result.count !== "number") {
        throw new Error("Réponse de confirmation invalide.");
      }
      setConfirmed(result.confirmed);
      setConfirmationCount(result.count);
    } catch (cause) {
      console.error("[PCS] Confirmation du signalement impossible", cause);
      setInteractionMessage("Impossible d’enregistrer votre confirmation. Vérifiez votre connexion puis réessayez.");
    } finally {
      setInteractionBusy(false);
    }
  };

  const submitPublicComment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !report.id || !visitorToken) {
      setInteractionMessage("Impossible de créer votre identifiant citoyen. Rechargez la page puis réessayez.");
      return;
    }
    const body = commentText.trim();
    if (body.length < 2 || body.length > 1000) {
      setInteractionMessage("Le commentaire doit contenir entre 2 et 1 000 caractères.");
      return;
    }
    setInteractionBusy(true);
    setInteractionMessage("");
    try {
      const { error } = await supabase.rpc("submit_public_report_comment", {
        p_report_id: report.id!,
        p_body: body,
        p_display_name: null as unknown as string,
        p_visitor_token: visitorToken,
      });
      if (error) throw error;
      setCommentText("");
      const { data, error: commentsError } = await supabase.rpc("list_public_report_comments", {
        p_report_id: report.id!,
      });
      if (commentsError) throw commentsError;
      setPublicComments((data ?? []) as { id: string; display_name: string | null; body: string; created_at: string }[]);
      setCommentsOpen(true);
      setInteractionMessage("Votre commentaire a été publié.");
    } catch {
      setInteractionMessage("Impossible de publier le commentaire. Réessayez.");
    } finally {
      setInteractionBusy(false);
    }
  };

  return (
    <article ref={slideRef} className="citizenSlide citizenSlideTrack">
      <div className="slideContent">
        {mediaReady && media.length > 0 ? (
          <MediaCarousel media={media} />
        ) : mediaReady ? null : (
          <div className="mediaCarousel mediaCarouselPlaceholder" aria-hidden="true">
            <div className="mediaCarouselItem" />
          </div>
        )}

        <div className="slideOverlay">
          <p className="eyebrow feedEyebrow">
            {report.status ? statusLabels[report.status] : "Signalement"}
          </p>

          <div className="row">
            <strong>{report.reference_code ?? "PCS"}</strong>
            <span className="badge" data-pcs-tour="status">
              {report.priority ?? "normal"}
            </span>
          </div>

          <h2>{report.title}</h2>

          {report.location_label && (
            <p>
              <strong>📍</strong> {report.location_label}
            </p>
          )}

          {report.resolution_note && (
            <p>
              <strong>Résolution :</strong> {report.resolution_note}
            </p>
          )}

          <div className="citizenReportInteractions" aria-label="Interactions citoyennes">
            <div className="feedActions">
              <button type="button" className={confirmed ? "feedPrimary" : "feedSecondary"} onClick={toggleConfirmation} disabled={interactionBusy}>
                {confirmed ? "✓ Confirmé" : "Je confirme"}
              </button>
              <button type="button" className="feedSecondary" onClick={() => setCommentsOpen((open) => !open)} aria-expanded={commentsOpen}>
                Commenter ({publicComments.length})
              </button>
            </div>
            {commentsOpen && (
              <section className="citizenPublicComments" aria-label="Commentaires du signalement">
                <div className="citizenCommentsHeader">
                  <h3>Commentaires ({publicComments.length})</h3>
                  <button
                    type="button"
                    className="feedSecondary"
                    onClick={() => {
                      setCommentsOpen(false);
                      setInteractionMessage("");
                    }}
                    aria-label="Fermer les commentaires"
                  >
                    Fermer ✕
                  </button>
                </div>
                {publicComments.length === 0 ? <p>Aucun commentaire public pour le moment.</p> : publicComments.map((comment) => (
                  <article key={comment.id} className="citizenPublicComment">
                    {comment.display_name && <strong>{comment.display_name}</strong>}
                    <p>{comment.body}</p>
                    <small>{new Date(comment.created_at).toLocaleString("fr-FR")}</small>
                  </article>
                ))}
                <form onSubmit={submitPublicComment}>
                  <label htmlFor={`public-comment-${report.id}`}>Votre commentaire</label>
                  <textarea
                    id={`public-comment-${report.id}`}
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    minLength={2}
                    maxLength={1000}
                    rows={3}
                    placeholder="Partagez une information utile…"
                    required
                  />
                  <button type="submit" className="feedPrimary" disabled={interactionBusy || commentText.trim().length < 2}>
                    {interactionBusy ? "Envoi…" : "Publier le commentaire"}
                  </button>
                </form>
              </section>
            )}
            {interactionMessage && <p role="status" aria-live="polite">{interactionMessage}</p>}
          </div>
        </div>
      </div>
    </article>
  );
}
