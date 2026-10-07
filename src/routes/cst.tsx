import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/cst")({
  head: () => ({
    meta: [
      { title: "CST — PCS" },
      { name: "description", content: "Centre de Supervision Technique PCS." },
    ],
  }),
  component: Outlet,
});
