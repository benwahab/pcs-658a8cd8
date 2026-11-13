import { createFileRoute } from "@tanstack/react-router";
import Home from "@/pcs/pages/Home";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PCS — Signalement citoyen" },
      {
        name: "description",
        content: "Signaler, localiser et suivre les problèmes d’intérêt public au Niger.",
      },
      { property: "og:title", content: "PCS — Signalement citoyen" },
      {
        property: "og:description",
        content: "Signaler, localiser et suivre les problèmes d’intérêt public au Niger.",
      },
    ],
  }),
  component: Home,
});
