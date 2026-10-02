import { createFileRoute } from "@tanstack/react-router";
import OrganizationDashboard from "@/pcs/pages/OrganizationDashboard";

export const Route = createFileRoute("/organisation")({
  head: () => ({
    meta: [
      { title: "Espace organisation — PCS" },
      { name: "description", content: "Réception des signalements et affectation aux agences." },
      { property: "og:title", content: "Espace organisation — PCS" },
      {
        property: "og:description",
        content: "Réception des signalements et affectation aux agences.",
      },
    ],
  }),
  component: OrganizationDashboard,
});
