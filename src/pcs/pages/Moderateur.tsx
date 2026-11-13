import { useEffect, useState } from "react";
import { Link, useNavigate } from "@/pcs/router";
import { supabase } from "@/pcs/lib/supabase";

async function moderation(body: Record<string, unknown> = { action: "list" }) {
  if (!supabase) throw new Error("Supabase non configuré.");
  const { data, error } = await supabase.functions.invoke("cst-media-moderation", { body });
  if (error) {
    const e = new Error(data?.error ?? "Service de modération indisponible.");
    (e as Error & { status?: number }).status = error.context?.status;
    throw e;
  }
  if (data?.error) throw new Error(data.error);
  return data as any;
}

export default function Moderateur() {
  const nav = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [region, setRegion] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rejectingId, setRejectingId] = useState("");
  const [reason, setReason] = useState("");

  async function load() {
    try {
      const result = await moderation({ action: "list" });
      setItems(result.items ?? []);
      setRegion(result.region?.name ?? "Toutes les régions");
      setError("");
    } catch (e) {
      if (
        (e as Error & { status?: number })?.status === 401 ||
        (e as Error & { status?: number })?.status === 403
      )
        await supabase?.auth.signOut();
      setError(e instanceof Error ? e.message : "Accès modérateur refusé.");
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function approve(id: string) {
    setBusy(true);
    setError("");
    try {
      await moderation({ action: "approve", media_id: id });
      setItems((v) => v.filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approbation impossible.");
    } finally {
      setBusy(false);
    }
  }
  async function reject(id: string) {
    const value = reason.trim();
    if (value.length < 5) {
      setError("Le motif du rejet doit contenir au moins 5 caractères.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await moderation({ action: "reject", media_id: id, reason: value });
      setItems((v) => v.filter((x) => x.id !== id));
      setRejectingId("");
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rejet impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="moderatorDashboard">
      <aside className="moderatorSidebar">
        <div className="moderatorBrand">
          <span className="moderatorBrandMark">PCS</span>
          <div>
            <strong>PCS</strong>
            <small>ESPACE PROFESSIONNEL</small>
          </div>
        </div>
        <p className="moderatorMenuLabel">SUPERVISION</p>
        <nav>
          <a className="active" href="#moderator-home">
            <span>⌂</span>Tableau de bord
          </a>
          <a href="#moderator-queue">
            <span>▣</span>File de modération <b>{items.length}</b>
          </a>
          <a href="#moderator-guidance">
            <span>ⓘ</span>Consignes
          </a>
        </nav>
        <div className="moderatorSidebarFoot">
          <i />
          <div>
            <strong>Accès régional</strong>
            <small>{region || "Région en cours de chargement"}</small>
          </div>
        </div>
      </aside>
      <main className="moderatorMain" id="moderator-home">
        <header className="moderatorTopbar">
          <div>
            <p className="eyebrow">PCS · MODÉRATION</p>
            <h1>Tableau de bord</h1>
            <p>Validation des médias citoyens de votre région.</p>
          </div>
          <div className="moderatorTopActions">
            <span className="moderatorRegionPill">⌖ {region || "—"}</span>
            <button className="button" onClick={load}>
              ↻ Actualiser
            </button>
            <button
              className="button"
              onClick={async () => {
                await supabase?.auth.signOut();
                nav("/");
              }}
            >
              Déconnexion
            </button>
          </div>
        </header>
        {error && (
          <div className="moderatorAlert" role="alert">
            {error}
            <Link className="button" to="/connexion-operationnelle?mode=moderator">
              Se reconnecter
            </Link>
          </div>
        )}
        <section className="moderatorKpis" aria-label="Indicateurs de modération">
          <article>
            <span className="moderatorKpiIcon">▣</span>
            <div>
              <small>Médias en attente</small>
              <strong>{items.length}</strong>
              <span>Dans votre périmètre régional</span>
            </div>
          </article>
          <article>
            <span className="moderatorKpiIcon soft">✓</span>
            <div>
              <small>File de validation</small>
              <strong>{items.length === 0 ? "Vide" : "À examiner"}</strong>
              <span>Décision avant publication</span>
            </div>
          </article>
        </section>
        <section className="moderatorPanel" id="moderator-queue">
          <div className="moderatorPanelHead">
            <div>
              <h2>File de modération</h2>
              <p>
                Seules les vidéos de signalement citoyen de votre région apparaissent ici. Les
                vidéos de résolution des agents terrain restent hors de cette file.
              </p>
            </div>
            <span className="moderatorCount">{items.length} en attente</span>
          </div>
          {items.length === 0 && !error ? (
            <div className="moderatorEmpty">
              <span>✓</span>
              <h3>La file est à jour</h3>
              <p>Aucune vidéo de signalement n'attend actuellement votre validation.</p>
            </div>
          ) : (
            <div className="moderatorQueueGrid">
              {items.map((v) => (
                <article className="moderatorMediaCard" key={v.id}>
                  <div className="moderatorMediaHead">
                    <span className="moderatorPending">EN ATTENTE</span>
                    <small>
                      {v.created_at ? new Date(v.created_at).toLocaleString("fr-FR") : "—"}
                    </small>
                  </div>
                  <div className="moderatorReportMeta">
                    <strong>{v.report?.reference_code ?? "Signalement"}</strong>
                    <span>{v.report?.location_label ?? "Localisation non renseignée"}</span>
                  </div>
                  <h3>{v.report?.title ?? "Vidéo de signalement"}</h3>
                  {v.preview_url ? (
                    <video src={v.preview_url} controls playsInline preload="metadata" />
                  ) : (
                    <div className="moderatorNoPreview">
                      Prévisualisation indisponible pour ce média.
                    </div>
                  )}
                  {rejectingId === v.id ? (
                    <div className="moderatorRejectForm">
                      <label>
                        Motif du rejet
                        <textarea
                          minLength={5}
                          maxLength={500}
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Expliquez clairement le motif du rejet."
                        />
                      </label>
                      <div>
                        <button
                          className="button"
                          disabled={busy}
                          onClick={() => {
                            setRejectingId("");
                            setReason("");
                          }}
                        >
                          Annuler
                        </button>
                        <button
                          className="button primary"
                          disabled={busy || reason.trim().length < 5}
                          onClick={() => void reject(v.id)}
                        >
                          Confirmer le rejet
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="moderatorMediaActions">
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={() => void approve(v.id)}
                      >
                        ✓ Approuver et publier
                      </button>
                      <button
                        className="button"
                        disabled={busy}
                        onClick={() => {
                          setRejectingId(v.id);
                          setReason("");
                          setError("");
                        }}
                      >
                        Rejeter
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="moderatorGuidance" id="moderator-guidance">
          <span>ⓘ</span>
          <div>
            <strong>Règle de publication</strong>
            <p>
              Un média citoyen n'est visible publiquement qu'après validation. Les médias de
              résolution transmis par les agents terrain ne font pas partie de cette file régionale.
            </p>
          </div>
        </section>
      </main>
    </section>
  );
}
