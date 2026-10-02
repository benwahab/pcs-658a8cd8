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
    <section className="narrow authScreen">
      <div className="sectionHead">
        <div>
          <p className="eyebrow">ESPACE PROFESSIONNEL</p>
          <h1>Modération régionale</h1>
          <p>
            Région : <strong>{region || "—"}</strong>
          </p>
        </div>
        <div>
          <button className="button" onClick={load}>
            ↻ Actualiser
          </button>
        </div>
      </div>
      {error && (
        <div className="card error">
          {error}
          <div style={{ marginTop: 12 }}>
            <Link className="button" to="/connexion-operationnelle?mode=moderator">
              Se reconnecter
            </Link>
          </div>
        </div>
      )}
      <div className="card">
        <strong>{items.length} vidéo(s) en attente</strong>
        <p>
          Seules les vidéos de signalement citoyen de votre région apparaissent ici. Les vidéos de
          résolution des agents terrain restent hors de cette file.
        </p>
      </div>
      <div className="grid">
        {items.map((v) => (
          <article className="card" key={v.id}>
            <span className="badge">EN ATTENTE</span>
            <h2>{v.report?.reference_code ?? "Signalement"}</h2>
            <h3>{v.report?.title ?? "Vidéo de signalement"}</h3>
            <p>{v.report?.location_label ?? "Localisation non renseignée"}</p>
            <small>{v.created_at ? new Date(v.created_at).toLocaleString("fr-FR") : "—"}</small>
            {v.preview_url && (
              <video
                src={v.preview_url}
                controls
                playsInline
                preload="metadata"
                style={{ width: "100%", marginTop: 16, borderRadius: 12 }}
              />
            )}
            {rejectingId === v.id ? (
              <div className="form" style={{ marginTop: 16 }}>
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
                  </button>{" "}
                  <button
                    className="button"
                    disabled={busy || reason.trim().length < 5}
                    onClick={() => void reject(v.id)}
                  >
                    Confirmer le rejet
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 16 }}>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => void approve(v.id)}
                >
                  ✓ Approuver et publier
                </button>{" "}
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => {
                    setRejectingId(v.id);
                    setReason("");
                    setError("");
                  }}
                >
                  ✕ Rejeter
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      {!items.length && !error && (
        <div className="card">
          <h2>File vide</h2>
          <p>Aucune vidéo de signalement n'attend actuellement votre validation.</p>
        </div>
      )}
      <div style={{ marginTop: 20 }}>
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
    </section>
  );
}
