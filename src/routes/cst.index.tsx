import { createFileRoute } from "@tanstack/react-router";
import { CSTAccess } from "@/pcs/pages/CST";

export const Route = createFileRoute("/cst/")({
  component: CSTAccess,
});
