import { createFileRoute } from "@tanstack/react-router";
import CSTModerateurs from "@/pcs/pages/CSTModerateurs";

export const Route = createFileRoute("/cst/moderateurs")({
  head: () => ({
    meta: [
      { title: "Gestion des modérateurs — CST" },
      { name: "description", content: "Gestion des comptes modérateurs régionaux PCS." },
    ],
  }),
  component: CSTModerateurs,
});
