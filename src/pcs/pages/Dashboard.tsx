import { useEffect, useMemo, useState } from "react";
import { Link } from "@/pcs/router";
import { listAllReports, listCategoriesForAdmin, listDepartments } from "../services/admin";
import { statusLabels, type ReportPriority, type ReportStatus } from "../types";

type Row = {
  id: string;
  status: ReportStatus;
  priority: ReportPriority;
  created_at: string;
  category_id: string;
  department_id: string | null;
};
export default function Dashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");
  const [department, setDepartment] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  async function load() {
    try {
      setRows(
        (await listAllReports({
          status: (status as ReportStatus) || undefined,
          priority: (priority as ReportPriority) || undefined,
          categoryId: category || undefined,
          departmentId: department || undefined,
          search: search || undefined,
        })) as Row[],
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }
  useEffect(() => {
    Promise.all([listCategoriesForAdmin(), listDepartments()])
      .then(([c, d]) => {
        setCategories(c);
        setDepartments(d);
      })
      .catch((e) => setError(e.message));
    load();
  }, []);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [status, priority, category, department, search]);
  const counts = useMemo(
    () =>
      Object.keys(statusLabels).reduce(
        (a, k) => ({ ...a, [k]: rows.filter((r) => r.status === k).length }),
        {} as Record<string, number>,
      ),
    [rows],
  );
  return (
    <section>
      <div className="sectionHead">
        <div>
          <p className="eyebrow">PILOTAGE</p>
          <h1>Tableau de bord</h1>
        </div>
        <Link className="button" to="/admin">
          Traitement
        </Link>
      </div>
      {error && <div className="card error">{error}</div>}
      <div className="stats">
        {Object.entries(statusLabels).map(([k, label]) => (
          <div className="card stat" key={k}>
            <span>{label}</span>
            <strong>{counts[k] ?? 0}</strong>
          </div>
        ))}
      </div>
      <div className="card form">
        <div className="grid">
          <label>
            Recherche
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Référence ou titre"
            />
          </label>
          <label>
            Statut
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Tous</option>
              {Object.entries(statusLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Priorité
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="">Toutes</option>
              <option value="low">Faible</option>
              <option value="normal">Normale</option>
              <option value="high">Haute</option>
              <option value="urgent">Urgente</option>
            </select>
          </label>
          <label>
            Catégorie
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Toutes</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Service
            <select value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">Tous</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="card">
        <h2>Résultats</h2>
        <p>{rows.length} signalement(s) correspondant aux filtres.</p>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Référence</th>
                <th>Statut</th>
                <th>Priorité</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link to={"/signalement/" + r.id}>{r.id.slice(0, 8)}</Link>
                  </td>
                  <td>{statusLabels[r.status]}</td>
                  <td>{r.priority}</td>
                  <td>{new Date(r.created_at).toLocaleDateString("fr-FR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
