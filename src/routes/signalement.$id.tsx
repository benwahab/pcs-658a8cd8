import { createFileRoute } from "@tanstack/react-router";
import ReportDetail from "@/pcs/pages/ReportDetail";

export const Route = createFileRoute("/signalement/$id")({
  head: () => ({
    meta: [
      { title: "Signalement — PCS" },
      { name: "description", content: "Détail, historique et résolution d’un signalement." },
      { property: "og:title", content: "Signalement — PCS" },
      { property: "og:description", content: "Détail, historique et résolution d’un signalement." },
    ],
  }),
  component: ReportDetail,
});
