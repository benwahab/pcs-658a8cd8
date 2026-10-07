import { createFileRoute } from "@tanstack/react-router";
import Notifications from "@/pcs/pages/Notifications";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — PCS" },
      { name: "description", content: "Vos notifications PCS." },
      { property: "og:title", content: "Notifications — PCS" },
      { property: "og:description", content: "Vos notifications PCS." },
    ],
  }),
  component: Notifications,
});
