import { useEffect, useState } from "react";
import { Link } from "@/pcs/router";
import { supabase } from "../lib/supabase";
import { addInternalComment, listAllReports } from "../services/admin";
import { createReportMediaUrl } from "../services/media";

type ReportRow = {
  id: string;
  reference_code: string;
  title: string;
  description?: string | null;
  status: string;
};

type ModerationMedia = {
  id: string;
  storage_path: string;
  media_type: string;
  media_role: string;
  moderation_status: string;
  url?: string;
  urlError?: string;
};

type ReportWithMedia = ReportRow & { media: ModerationMedia[] };

export default function Moderation() {
  const [rows, setRows] = useState<ReportWithMedia[]>([]);
  const [error, setError] = useState("");
  const [comment, setComment] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      if (!supabase) throw new Error("Supabase n’est pas configuré.");
      const reports = (await listAllReports()) as ReportRow[];
      const mediaResult = reports.length
        ? await supabase
            .from("report_media")
            .select("id,report_id,storage_path,media_type,media_role,moderation_status")
            .in("report_id", reports.map((report) => report.id))
            .order("created_at", { ascending: true })
        : { data: [], error: null };

      if (mediaResult.error) throw mediaResult.error;
      const mediaRows = (mediaResult.data ?? []) as (ModerationMedia & {
        report_id: string;
      })[];

      const withMedia = await Promise.all(
        reports.map(async (report) => {
          const media = await Promise.all(
            mediaRows
              .filter((item) => item.report_id === report.id)
              .map(async (item): Promise<ModerationMedia> => {
                try {
                  return {
                    ...item,
                    url: await createReportMediaUrl(item.storage_path, 900),
                  };
                } catch {
                  return {
                    ...item,
                    urlError:
                      "Lecture indisponible : accès au média refusé ou fichier introuvable.",
                  };
                }
              }),
          );
          return { ...report, media };
        }),
      );
      setRows(withMedia);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Impossible de charger les signalements à modérer.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(id: string) {
    const body = (comment[id] ?? "").trim();
    if (!body) return;
    setSaving(id);
    setError("");
    try {
      await addInternalComment(id, body);
      setComment((current) => ({ ...current, [id]: "" }));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Impossible d’enregistrer la note.",
      );
    } finally {
      setSaving(null);
    }
  }

  return (
    <section>
      <div className="sectionHead">
        <div>
          <p className="eyebrow">CONTRÔLE DU CONTENU</p>
          <h1>Modération des signalements</h1>
        </div>
        <Link className="button" to="/admin">Traitement</Link>
      </div>

      {error && <div className="card error" role="alert">{error}</div>}

      {loading ? (
        <div className="card" role="status">Chargement des signalements et de leurs médias…</div>
      ) : rows.length === 0 ? (
        <div className="card">Aucun signalement à afficher.</div>
      ) : (
        <div className="grid">
          {rows.map((report) => (
            <article className="card" key={report.id}>
              <strong>{report.reference_code}</strong>
              <h3>{report.title}</h3>
              {report.description ? <p>{report.description}</p> : null}
              <small>Statut du signalement : {report.status}</small>

              <div className="moderationMedia" style={{ marginTop: 16 }}>
                <h4>Photos et vidéos ({report.media.length})</h4>
                {report.media.length === 0 ? (
                  <p>Aucun média associé à ce signalement.</p>
                ) : (
                  report.media.map((media) => (
                    <div className="card" key={media.id} style={{ marginTop: 12 }}>
                      <p>
                        <strong>
                          {media.media_role === "citizen_evidence"
                            ? "Preuve citoyenne"
                            : media.media_role === "resolution_video"
                              ? "Vidéo de résolution"
                              : "Média"}
                        </strong>
                        {" · "}
                        {media.moderation_status}
                      </p>
                      {media.url ? (
                        media.media_type.startsWith("video/") ||
                        media.media_role === "resolution_video" ? (
                          <video
                            src={media.url}
                            controls
                            playsInline
                            preload="metadata"
                            style={{ display: "block", width: "100%", maxHeight: 420, background: "#111", borderRadius: 8 }}
                          >
                            Votre navigateur ne prend pas en charge la lecture vidéo.
                          </video>
                        ) : media.media_type.startsWith("image/") ? (
                          <img
                            src={media.url}
                            alt={"Preuve du signalement " + report.reference_code}
                            loading="lazy"
                            style={{ display: "block", width: "100%", maxHeight: 420, objectFit: "contain", borderRadius: 8 }}
                          />
                        ) : (
                          <a href={media.url} target="_blank" rel="noreferrer">
                            Ouvrir le média
                          </a>
                        )
                      ) : (
                        <p className="error" role="status">
                          {media.urlError ?? "Média indisponible."}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>

              <label className="form" style={{ marginTop: 16 }}>
                Note interne
                <textarea
                  rows={3}
                  value={comment[report.id] ?? ""}
                  onChange={(event) =>
                    setComment((current) => ({
                      ...current,
                      [report.id]: event.target.value,
                    }))
                  }
                  placeholder="Motif, vérification, consigne…"
                />
              </label>
              <button
                className="button"
                disabled={saving === report.id || !(comment[report.id] ?? "").trim()}
                onClick={() => void save(report.id)}
              >
                {saving === report.id ? "Enregistrement…" : "Ajouter la note"}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
