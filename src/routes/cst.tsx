import { createFileRoute } from "@tanstack/react-router";
import { CSTAccess } from "@/pcs/pages/CST";

export const Route = createFileRoute("/cst")({
  head: () => ({ meta: [{ title: "CST — PCS" }, { name: "description", content: "Centre de Supervision Technique PCS." }] }),
  component: CSTAccess,
});