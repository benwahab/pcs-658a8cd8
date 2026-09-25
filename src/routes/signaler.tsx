import { createFileRoute } from "@tanstack/react-router";
import { ReportForm } from "@/pcs/App";

export const Route = createFileRoute("/signaler")({
  head: () => ({
    meta: [
      { title: "Faire un signalement — PCS" },
      { name: "description", content: "Signalez un problème public avec photos et position GPS." },
      { property: "og:title", content: "Faire un signalement — PCS" },
      { property: "og:description", content: "Signalez un problème public avec photos et position GPS." },
    ],
  }),
  component: ReportForm,
});
