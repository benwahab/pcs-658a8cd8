import { useEffect, useState } from "react";
import { Link, useLocation } from "@/pcs/router";
import Admin from "./Admin";
import Dashboard from "./Dashboard";
import Moderation from "./Moderation";
import { canOperate, getMyRoles, type AppRole } from "../services/permissions";

export default function ProtectedOperations() {
  const [roles, setRoles] = useState<AppRole[] | null>(null);
  const location = useLocation();

  useEffect(() => {
    getMyRoles()
      .then(setRoles)
      .catch(() => setRoles([]));
  }, []);

  if (roles === null) {
    return (
      <section className="narrow">
        <div className="card">Vérification des autorisations…</div>
      </section>
    );
  }

  if (!canOperate(roles)) {
    return (
      <section className="narrow">
        <div className="card error">Accès réservé aux utilisateurs habilités.</div>
        <Link to="/">Retour à l’accueil</Link>
      </section>
    );
  }

  if (location.pathname === "/admin") return <Admin />;
  if (location.pathname === "/dashboard") return <Dashboard />;
  return <Moderation />;
}
