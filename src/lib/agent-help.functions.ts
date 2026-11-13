import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  problem: z
    .string()
    .trim()
    .min(10, "Décrivez le problème en au moins 10 caractères.")
    .max(1000, "Description trop longue (1000 caractères maximum)."),
});

const SYSTEM = `Tu es l'assistant de dépannage de PCS (Plateforme Citoyenne de Signalement, Niger) pour les agents terrain.
Connexion agent : 1) l'agent saisit son numéro de téléphone professionnel (format +227 suivi de 8 chiffres, ou 8 chiffres) ; 2) PCS affiche son nom et matricule ; 3) il saisit son mot de passe dans les 5 minutes.
Règles connues : 5 essais de numéro et 3 essais de mot de passe par 10 minutes, puis blocage de 15 minutes. Seule la mairie ou l'agence qui a créé le compte peut réinitialiser le mot de passe ou réactiver un compte. Un numéro non reconnu signifie compte inexistant, désactivé ou numéro différent de celui enregistré.
Réponds en français simple, en 3 à 6 étapes numérotées courtes, adaptées au problème décrit, en commençant par les vérifications les plus probables (réseau, format du numéro, délai expiré, blocage temporaire). Termine par qui contacter si rien ne marche. Ne demande jamais le mot de passe et ne promets aucune action que tu ne peux pas faire.`;

export type AgentHelpResult = { ok: true; steps: string } | { ok: false; error: string };

export const getAgentLoginHelp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<AgentHelpResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false, error: "L'assistant n'est pas configuré pour le moment." };
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    try {
      const result = streamText({
        model: provider.responses("openai/gpt-6-astra"),
        system: SYSTEM,
        prompt: data.problem,
        maxRetries: 0,
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            store: false,
            include: ["reasoning.encrypted_content"],
          },
        },
      });
      const steps = (await result.text).trim();
      if (!steps)
        return {
          ok: false,
          error: "L'assistant n'a pas pu proposer d'étapes. Contactez votre mairie ou agence.",
        };
      return { ok: true, steps };
    } catch (e) {
      const status = (e as { statusCode?: number })?.statusCode;
      console.error("agent-help: gateway error", status, e instanceof Error ? e.message : e);
      if (status === 429)
        return { ok: false, error: "Trop de demandes en ce moment. Réessayez dans une minute." };
      if (status === 402 || status === 403)
        return {
          ok: false,
          error: "L'assistant est momentanément indisponible. Contactez votre mairie ou agence.",
        };
      return {
        ok: false,
        error:
          "L'assistant est indisponible. Réessayez plus tard ou contactez votre mairie ou agence.",
      };
    }
  });
