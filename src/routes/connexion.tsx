import { createFileRoute } from "@tanstack/react-router";
import { Auth } from "@/pcs/App";

export const Route = createFileRoute("/connexion")({
  head: () => ({
    meta: [
      { title: "Connexion — PCS" },
      { name: "description", content: "Connexion citoyenne à la plateforme PCS." },
      { property: "og:title", content: "Connexion — PCS" },
      { property: "og:description", content: "Connexion citoyenne à la plateforme PCS." },
    ],
  }),
  component: Auth,
});
