import { createFileRoute } from "@tanstack/react-router";
import OrganizationLogin from "@/pcs/pages/OrganizationLogin";

export const Route = createFileRoute("/connexion-nigelec")({
  head: () => ({
    meta: [
      { title: "Espace NIGELEC — PCS" },
      {
        name: "description",
        content: "Connexion et création de compte pour l’espace professionnel NIGELEC.",
      },
      { property: "og:title", content: "Espace NIGELEC — PCS" },
      {
        property: "og:description",
        content: "Connexion et création de compte pour l’espace professionnel NIGELEC.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <OrganizationLogin org="NIGELEC" />,
});
