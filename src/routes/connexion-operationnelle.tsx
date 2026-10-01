import { createFileRoute } from "@tanstack/react-router";
import OperationalLogin from "@/pcs/pages/OperationalLogin";

export const Route = createFileRoute("/connexion-operationnelle")({
  head: () => ({
    meta: [
      { title: "Accès professionnel — PCS" },
      { name: "description", content: "Connexion mairie, organisation et agent terrain." },
      { property: "og:title", content: "Accès professionnel — PCS" },
      { property: "og:description", content: "Connexion mairie, organisation et agent terrain." },
    ],
  }),
  component: OperationalLogin,
});
