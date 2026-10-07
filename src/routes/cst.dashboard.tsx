import { createFileRoute } from "@tanstack/react-router";
import { CSTDashboard } from "@/pcs/pages/CST";

export const Route = createFileRoute("/cst/dashboard")({
  head: () => ({ meta: [{ title: "CST Dashboard — PCS" }, { name: "description", content: "Supervision technique sécurisée de PCS." }] }),
  component: CSTDashboard,
});