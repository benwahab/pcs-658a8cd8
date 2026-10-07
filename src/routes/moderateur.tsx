import { createFileRoute } from "@tanstack/react-router";
import Moderateur from "@/pcs/pages/Moderateur";

export const Route = createFileRoute("/moderateur")({
  head: () => ({ meta: [{ title: "Modération régionale — PCS" }, { name: "description", content: "Modération régionale des vidéos de signalement citoyen." }] }),
  component: Moderateur,
});
