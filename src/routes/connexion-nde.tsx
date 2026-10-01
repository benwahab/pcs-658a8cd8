import { createFileRoute } from "@tanstack/react-router";
import OrganizationLogin from "@/pcs/pages/OrganizationLogin";

export const Route = createFileRoute("/connexion-nde")({
  head: () => ({
    meta: [
      { title: "Espace NDE — PCS" },
      { name: "description", content: "Connexion et création de compte pour l’espace professionnel NDE." },
      { property: "og:title", content: "Espace NDE — PCS" },
      { property: "og:description", content: "Connexion et création de compte pour l’espace professionnel NDE." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <OrganizationLogin org="NDE" />,
});
