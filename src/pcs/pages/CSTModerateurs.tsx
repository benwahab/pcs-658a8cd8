import { useEffect, useState } from "react";
import { Link, useNavigate } from "@/pcs/router";
import { supabase } from "@/pcs/lib/supabase";
import type { Tables } from "@/integrations/supabase/types";
import type { CstModerator } from "../types/cst";

async function cst(body: Record<string, unknown>): Promise<{ moderators?: CstModerator[] }> {
  if (!supabase) throw new Error("Supabase non configuré.");
  const { data, error } = await supabase.functions.invoke("cst-auth", { body });
  if (error || data?.error) throw new Error(data?.error ?? "Service CST indisponible.");
  return data;
}

export default function CSTModerateurs() {
  const nav = useNavigate();
  const [regions, setRegions] = useState<Pick<Tables<"regions">, "id" | "name" | "code">[]>([]);
  const [moderators, setModerators] = useState<CstModerator[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [regionId, setRegionId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const { data: session } = await supabase!.auth.getSession();
      if (!session.session) {
        nav("/cst");
        return;
      }
      const result = await cst({ action: "list_moderators" });
      setModerators(result.moderators ?? []);
      const { data, error: regionError } = await supabase!
        .from("regions")
        .select("id,name,code")
        .order("name");
      if (regionError) throw regionError;
      setRegions(data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger les modérateurs.");
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chargement initial au montage uniquement
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 12) {
      setError("Le mot de passe doit contenir au moins 12 caractères.");
      return;
    }
    setBusy(true);
    try {
      await cst({
        action: "create_moderator",
        full_name: fullName,
        email,
        password,
        region_id: regionId,
      });
      setFullName("");
      setEmail("");
      setPassword("");
      setRegionId("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Création impossible.");
    } finally {
      setBusy(false);
    }
  }
  async function toggle(m: CstModerator) {
    setBusy(true);
    setError("");
    try {
      await cst({ action: "set_moderator_active", user_id: m.user_id, is_active: !m.is_active });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Modification impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="narrow authScreen">
      <div className="sectionHead">
        <div>
          <p className="eyebrow">PCS / CST</p>
          <h1>Gestion des modérateurs</h1>
          <p>Création et délégation de la modération par région.</p>
        </div>
        <div>
          <Link className="button" to="/cst/dashboard">
            ← Retour au CST
          </Link>
        </div>
      </div>
      {error && <div className="card error">{error}</div>}
      <article className="card">
        <h2>Créer un modérateur</h2>
        <form className="form" onSubmit={create}>
          <label>
            Nom complet
            <input
              required
              minLength={2}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex. Amina Issoufou"
            />
          </label>
          <label>
            Email professionnel
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="moderateur@pcs.ne"
              autoComplete="email"
            />
          </label>
          <label>
            Région
            <select required value={regionId} onChange={(e) => setRegionId(e.target.value)}>
              <option value="">Choisir une région…</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mot de passe initial
            <input
              required
              minLength={12}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <small>Minimum 12 caractères.</small>
          </label>
          <button className="button primary" disabled={busy}>
            {busy ? "Création…" : "Créer le modérateur"}
          </button>
        </form>
      </article>
      <article className="card">
        <div className="sectionHead">
          <div>
            <h2>Modérateurs existants</h2>
            <p>{moderators.length} compte(s) configuré(s).</p>
          </div>
          <button className="button" onClick={load}>
            ↻ Actualiser
          </button>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Email</th>
                <th>Région</th>
                <th>Statut</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {moderators.map((m) => (
                <tr key={m.user_id}>
                  <td>
                    <strong>{m.full_name}</strong>
                  </td>
                  <td>{m.email}</td>
                  <td>{m.regions?.name ?? "—"}</td>
                  <td>
                    <span className="badge">{m.is_active ? "ACTIF" : "INACTIF"}</span>
                  </td>
                  <td>
                    <button className="button" disabled={busy} onClick={() => void toggle(m)}>
                      {m.is_active ? "Désactiver" : "Réactiver"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!moderators.length && <p>Aucun modérateur créé pour le moment.</p>}
      </article>
    </section>
  );
}
