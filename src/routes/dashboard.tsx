import { createFileRoute } from "@tanstack/react-router";
import ProtectedOperations from "@/pcs/pages/ProtectedOperations";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Tableau de bord — PCS" },
      { name: "description", content: "Tableau de bord des opérations PCS." },
      { property: "og:title", content: "Tableau de bord — PCS" },
      { property: "og:description", content: "Tableau de bord des opérations PCS." },
    ],
  }),
  component: ProtectedOperations,
});
