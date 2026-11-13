import { createFileRoute } from "@tanstack/react-router";
import MairieDashboard from "@/pcs/pages/MairieDashboard";

export const Route = createFileRoute("/mairie")({
  head: () => ({
    meta: [
      { title: "Espace mairie — PCS" },
      {
        name: "description",
        content: "Traitement et transmission des signalements de la commune.",
      },
      { property: "og:title", content: "Espace mairie — PCS" },
      {
        property: "og:description",
        content: "Traitement et transmission des signalements de la commune.",
      },
    ],
  }),
  component: MairieDashboard,
});
