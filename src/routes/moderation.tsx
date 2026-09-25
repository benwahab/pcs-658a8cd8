import { createFileRoute } from "@tanstack/react-router";
import { ProtectedOperations } from "@/pcs/App";

export const Route = createFileRoute("/moderation")({
  head: () => ({
    meta: [
      { title: "Modération — PCS" },
      { name: "description", content: "Modération des signalements PCS." },
      { property: "og:title", content: "Modération — PCS" },
      { property: "og:description", content: "Modération des signalements PCS." },
    ],
  }),
  component: ProtectedOperations,
});
