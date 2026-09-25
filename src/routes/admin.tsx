import { createFileRoute } from "@tanstack/react-router";
import { ProtectedOperations } from "@/pcs/App";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Opérations — PCS" },
      { name: "description", content: "Espace opérations réservé aux utilisateurs habilités." },
      { property: "og:title", content: "Opérations — PCS" },
      { property: "og:description", content: "Espace opérations réservé aux utilisateurs habilités." },
    ],
  }),
  component: ProtectedOperations,
});
