import { createFileRoute } from "@tanstack/react-router";
import AgentTerrain from "@/pcs/pages/AgentTerrain";

export const Route = createFileRoute("/agent-terrain")({
  head: () => ({
    meta: [
      { title: "Agent terrain — PCS" },
      { name: "description", content: "Missions, vérification GPS et résolution sur le terrain." },
      { property: "og:title", content: "Agent terrain — PCS" },
      { property: "og:description", content: "Missions, vérification GPS et résolution sur le terrain." },
    ],
  }),
  component: AgentTerrain,
});
