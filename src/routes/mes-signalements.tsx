import { createFileRoute } from "@tanstack/react-router";
import { MyReports } from "@/pcs/App";

export const Route = createFileRoute("/mes-signalements")({
  head: () => ({
    meta: [
      { title: "Mes signalements — PCS" },
      { name: "description", content: "Suivez vos signalements et leur historique." },
      { property: "og:title", content: "Mes signalements — PCS" },
      { property: "og:description", content: "Suivez vos signalements et leur historique." },
    ],
  }),
  component: MyReports,
});
